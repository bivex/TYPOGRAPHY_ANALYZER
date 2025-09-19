(() => {
  'use strict';
  
  const TYPOGRAPHY_ANALYZER = {
    // Конфигурация для анализа
    config: {
      minLineHeightRatio: 1.2,
      maxLineHeightRatio: 1.8,
      suspiciousWeights: ['100', '200', '800', '900'],
      commonFontSizes: ['12px', '14px', '16px', '18px', '20px', '24px', '32px'],
      redundancyThreshold: 1 // элементы с уникальными стилями
    },

    // Состояние анализатора
    state: {
      fontMap: new Map(),
      issues: [],
      highlightedElements: new Set(),
      fixableIssues: [] // Новый массив для готовых к исправлению проблем
    },

    // Сбор данных о типографике
    collectTypographyData() {
      const allElements = document.querySelectorAll('*:not(script):not(style):not(meta):not(link)');
      
      allElements.forEach(element => {
        // Пропускаем невидимые элементы
        if (element.offsetParent === null && element.tagName !== 'HTML') return;
        
        const computedStyle = getComputedStyle(element);
        const fontMetrics = {
          fontFamily: computedStyle.fontFamily,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          lineHeight: computedStyle.lineHeight,
          letterSpacing: computedStyle.letterSpacing,
          textTransform: computedStyle.textTransform,
          element: element,
          tagName: element.tagName.toLowerCase(),
          className: element.className,
          textContent: element.textContent?.trim().substring(0, 50) || ''
        };

        const key = `${fontMetrics.fontFamily}|${fontMetrics.fontSize}|${fontMetrics.fontWeight}|${fontMetrics.lineHeight}`;
        
        if (!this.state.fontMap.has(key)) {
          this.state.fontMap.set(key, {
            metrics: fontMetrics,
            elements: [],
            count: 0
          });
        }
        
        const entry = this.state.fontMap.get(key);
        entry.elements.push(element);
        entry.count++;
      });
    },

    // Генерация селектора для элемента
    generateSelector(element) {
      let selector = element.tagName.toLowerCase();
      
      // Добавляем ID если есть
      if (element.id) {
        return `#${element.id}`;
      }
      
      // Добавляем классы если есть
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/);
        if (classes.length > 0 && classes[0] !== '') {
          selector += '.' + classes.join('.');
        }
      }
      
      // Если селектор слишком общий, добавляем nth-child
      const similarElements = document.querySelectorAll(selector);
      if (similarElements.length > 1) {
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(child => 
            child.tagName === element.tagName && 
            child.className === element.className
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            selector += `:nth-child(${index})`;
          }
        }
      }
      
      return selector;
    },

    // Создание объекта с исправлениями
    createFixableIssue(type, severity, elements, currentValues, suggestedFix, reasoning) {
      const fixes = elements.map(element => ({
        selector: this.generateSelector(element),
        tagName: element.tagName.toLowerCase(),
        className: element.className || null,
        textPreview: element.textContent?.trim().substring(0, 30) || '(empty)',
        currentCSS: currentValues,
        suggestedCSS: suggestedFix,
        elementPath: this.getElementPath(element)
      }));

      this.state.fixableIssues.push({
        issueType: type,
        severity: severity,
        description: reasoning,
        affectedElements: fixes.length,
        fixes: fixes
      });
    },

    // Получение пути до элемента
    getElementPath(element) {
      const path = [];
      let current = element;
      
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector += `#${current.id}`;
          path.unshift(selector);
          break;
        }
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/);
          if (classes.length > 0 && classes[0] !== '') {
            selector += '.' + classes[0];
          }
        }
        path.unshift(selector);
        current = current.parentElement;
      }
      
      return path.join(' > ');
    },

    // Анализ проблем
    analyzeIssues() {
      this.state.fontMap.forEach((data, key) => {
        const { metrics, elements, count } = data;
        const { fontSize, lineHeight, fontWeight, fontFamily } = metrics;
        
        // Анализ line-height
        const fontSizeNum = parseFloat(fontSize);
        const lineHeightNum = parseFloat(lineHeight);
        const lineHeightRatio = lineHeightNum / fontSizeNum;
        
        if (lineHeightRatio < this.config.minLineHeightRatio) {
          const suggestedLineHeight = Math.round(fontSizeNum * 1.4) + 'px';
          this.addIssue('critical', '📏 Критический line-height', 
            `Соотношение ${lineHeightRatio.toFixed(2)} < ${this.config.minLineHeightRatio}`, 
            elements, { fontSize, lineHeight });
          
          this.createFixableIssue(
            'line-height-too-small',
            'critical',
            elements,
            { 'line-height': lineHeight },
            { 'line-height': suggestedLineHeight },
            `Line-height слишком маленький (${lineHeightRatio.toFixed(2)}). Рекомендуется 1.4-1.6 для удобочитаемости.`
          );
        } else if (lineHeightRatio > this.config.maxLineHeightRatio) {
          const suggestedLineHeight = Math.round(fontSizeNum * 1.5) + 'px';
          this.addIssue('warning', '📐 Избыточный line-height', 
            `Соотношение ${lineHeightRatio.toFixed(2)} > ${this.config.maxLineHeightRatio}`, 
            elements, { fontSize, lineHeight });
            
          this.createFixableIssue(
            'line-height-too-large',
            'warning',
            elements,
            { 'line-height': lineHeight },
            { 'line-height': suggestedLineHeight },
            `Line-height избыточный (${lineHeightRatio.toFixed(2)}). Может ухудшать восприятие текста.`
          );
        }
        
        // Анализ font-weight
        if (this.config.suspiciousWeights.includes(fontWeight)) {
          const suggestedWeight = fontWeight === '100' || fontWeight === '200' ? '400' : 
                                  fontWeight === '800' || fontWeight === '900' ? '700' : fontWeight;
          
          this.addIssue('warning', '💪 Экстремальный font-weight', 
            `font-weight: ${fontWeight}`, elements, { fontWeight });
            
          this.createFixableIssue(
            'extreme-font-weight',
            'warning',
            elements,
            { 'font-weight': fontWeight },
            { 'font-weight': suggestedWeight },
            `Экстремальное значение font-weight (${fontWeight}). Может влиять на читаемость и совместимость.`
          );
        }
        
        // Анализ уникальности (потенциальная избыточность)
        if (count <= this.config.redundancyThreshold) {
          this.addIssue('info', '🔍 Уникальная комбинация', 
            'Используется только в одном месте', elements, metrics);
            
          this.createFixableIssue(
            'redundant-style',
            'info',
            elements,
            {
              'font-family': fontFamily,
              'font-size': fontSize,
              'font-weight': fontWeight,
              'line-height': lineHeight
            },
            '/* Рассмотреть объединение с существующим стилем */',
            'Уникальная комбинация стилей. Возможно, стоит использовать существующий стиль для консистентности.'
          );
        }
        
        // Анализ смешанных шрифтовых семейств
        const familyLower = fontFamily.toLowerCase();
        if (familyLower.includes('serif') && familyLower.includes('sans')) {
          this.addIssue('warning', '⚠️ Смешанные семейства', 
            'serif и sans-serif в одном объявлении', elements, { fontFamily });
            
          this.createFixableIssue(
            'mixed-font-families',
            'warning',
            elements,
            { 'font-family': fontFamily },
            { 'font-family': '/* Выберите один тип: serif ИЛИ sans-serif */' },
            'Смешивание serif и sans-serif в одном font-family может привести к неожиданным результатам.'
          );
        }
        
        // Анализ консистентности размеров
        if (!this.config.commonFontSizes.includes(fontSize) && fontSizeNum > 10) {
          const nearestSize = this.findNearestStandardSize(fontSizeNum);
          this.addIssue('info', '📊 Нестандартный размер', 
            `Размер ${fontSize} не входит в типичную шкалу`, elements, { fontSize });
            
          this.createFixableIssue(
            'non-standard-size',
            'info',
            elements,
            { 'font-size': fontSize },
            { 'font-size': nearestSize },
            `Нестандартный размер шрифта. Рекомендуется использовать размеры из типографской шкалы.`
          );
        }
      });
    },

    // Поиск ближайшего стандартного размера
    findNearestStandardSize(currentSize) {
      const sizes = this.config.commonFontSizes.map(s => parseFloat(s));
      return sizes.reduce((prev, curr) => 
        Math.abs(curr - currentSize) < Math.abs(prev - currentSize) ? curr : prev
      ) + 'px';
    },

    // Добавление проблемы
    addIssue(severity, type, description, elements, details) {
      this.state.issues.push({
        severity,
        type,
        description,
        elements: [...elements],
        details,
        count: elements.length
      });
    },

    // Создание интерактивной таблицы
    createInteractiveTable() {
      // Создаем контейнер
      const container = document.createElement('div');
      container.id = 'typography-analyzer-results';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 560px;
        max-height: 70vh;
        background: #1a1a1a;
        border: 2px solid #333;
        border-radius: 8px;
        color: #fff;
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 12px;
        z-index: 10000;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      `;

      // Header
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 12px 16px;
        background: #333;
        border-bottom: 1px solid #444;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      header.innerHTML = `
        <span>🔍 Typography Analyzer</span>
        <button id="close-analyzer" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;">✕</button>
      `;

      // Stats
      const stats = document.createElement('div');
      stats.style.cssText = 'padding: 12px 16px; background: #2a2a2a; border-bottom: 1px solid #444;';
      const totalCombinations = this.state.fontMap.size;
      const criticalIssues = this.state.issues.filter(i => i.severity === 'critical').length;
      const warningIssues = this.state.issues.filter(i => i.severity === 'warning').length;
      const infoIssues = this.state.issues.filter(i => i.severity === 'info').length;
      
      stats.innerHTML = `
        📊 Всего комбинаций: ${totalCombinations} | 
        🚨 Критических: ${criticalIssues} |
        ⚠️ Предупреждений: ${warningIssues} |
        💡 Инфо: ${infoIssues}
      `;

      // Table
      const table = document.createElement('div');
      table.style.cssText = 'padding: 8px;';
      
      this.state.issues.forEach((issue, index) => {
        const row = document.createElement('div');
        row.style.cssText = `
          padding: 8px 12px;
          margin: 4px 0;
          border-left: 4px solid ${this.getSeverityColor(issue.severity)};
          background: #2a2a2a;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;
        `;
        
        row.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 4px;">
            ${issue.type} <span style="color: #666;">(${issue.count} элементов)</span>
          </div>
          <div style="color: #ccc; font-size: 11px;">
            ${issue.description}
          </div>
          <div style="color: #888; font-size: 10px; margin-top: 4px;">
            Клик для подсветки элементов
          </div>
        `;

        // Добавляем интерактивность
        row.addEventListener('click', () => this.highlightElements(issue.elements, index));
        row.addEventListener('mouseenter', () => {
          row.style.background = '#3a3a3a';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = '#2a2a2a';
        });

        table.appendChild(row);
      });

      // Controls - теперь с тремя кнопками копирования
      const controls = document.createElement('div');
      controls.style.cssText = 'padding: 12px 16px; background: #333; border-top: 1px solid #444;';
      
      const criticalCount = this.state.fixableIssues.filter(i => i.severity === 'critical').length;
      const nonCriticalCount = this.state.fixableIssues.filter(i => i.severity !== 'critical').length;
      
      controls.innerHTML = `
        <div style="margin-bottom: 8px;">
          <button id="clear-highlights" style="background:#444;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;margin-right:8px;">Очистить подсветку</button>
          <button id="export-report" style="background:#0066cc;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;margin-right:8px;">Экспорт в консоль</button>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="copy-all-fixes" style="background:#00cc66;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
            📋 Все (${this.state.fixableIssues.length})
          </button>
          <button id="copy-critical-fixes" style="background:#ff4444;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
            🚨 Критические (${criticalCount})
          </button>
          <button id="copy-non-critical-fixes" style="background:#ffaa00;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
            ⚠️ Остальные (${nonCriticalCount})
          </button>
        </div>
      `;

      // Сборка
      container.appendChild(header);
      container.appendChild(stats);
      container.appendChild(table);
      container.appendChild(controls);

      // Event listeners
      container.querySelector('#close-analyzer').addEventListener('click', () => {
        this.cleanup();
      });
      
      container.querySelector('#clear-highlights').addEventListener('click', () => {
        this.clearHighlights();
      });
      
      container.querySelector('#export-report').addEventListener('click', () => {
        this.exportToConsole();
      });

      // Обработчики для разных типов копирования
      container.querySelector('#copy-all-fixes').addEventListener('click', () => {
        this.copyFixesToClipboard('all');
      });

      container.querySelector('#copy-critical-fixes').addEventListener('click', () => {
        this.copyFixesToClipboard('critical');
      });

      container.querySelector('#copy-non-critical-fixes').addEventListener('click', () => {
        this.copyFixesToClipboard('non-critical');
      });

      document.body.appendChild(container);
    },

    // Копирование исправлений в буфер обмена с фильтрацией
    async copyFixesToClipboard(filterType = 'all') {
      let filteredIssues;
      let title;
      
      switch (filterType) {
        case 'critical':
          filteredIssues = this.state.fixableIssues.filter(issue => issue.severity === 'critical');
          title = 'КРИТИЧЕСКИЕ ПРОБЛЕМЫ';
          break;
        case 'non-critical':
          filteredIssues = this.state.fixableIssues.filter(issue => issue.severity !== 'critical');
          title = 'ПРЕДУПРЕЖДЕНИЯ И РЕКОМЕНДАЦИИ';
          break;
        default:
          filteredIssues = this.state.fixableIssues;
          title = 'ВСЕ ПРОБЛЕМЫ';
      }

      if (filteredIssues.length === 0) {
        this.showNotification(`❌ Нет проблем типа "${filterType}" для копирования`, 'info');
        return;
      }

      const fixesObject = {
        title: `🔍 Typography Analyzer - ${title}`,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        filterType: filterType,
        summary: {
          totalIssues: filteredIssues.length,
          critical: filteredIssues.filter(i => i.severity === 'critical').length,
          warning: filteredIssues.filter(i => i.severity === 'warning').length,
          info: filteredIssues.filter(i => i.severity === 'info').length,
          affectedElements: filteredIssues.reduce((sum, issue) => sum + issue.affectedElements, 0)
        },
        priorityOrder: this.getPriorityOrder(filterType),
        fixes: filteredIssues
          .sort((a, b) => this.getSeverityPriority(a.severity) - this.getSeverityPriority(b.severity))
          .map((issue, index) => ({
            id: index + 1,
            type: issue.issueType,
            severity: issue.severity,
            priority: this.getSeverityPriority(issue.severity),
            description: issue.description,
            elementsCount: issue.affectedElements,
            estimatedTime: this.getEstimatedFixTime(issue.issueType),
            fixes: issue.fixes.map((fix, fixIndex) => ({
              id: `${index + 1}.${fixIndex + 1}`,
              selector: fix.selector,
              element: `${fix.tagName}${fix.className ? '.' + fix.className.split(' ').join('.') : ''}`,
              textContent: fix.textPreview,
              path: fix.elementPath,
              currentCSS: fix.currentCSS,
              suggestedCSS: fix.suggestedCSS,
              cssRule: this.generateCSSRule(fix.selector, fix.suggestedCSS)
            }))
          }))
      };

      // Добавляем готовые CSS правила для быстрого применения
      fixesObject.readyToApplyCSS = this.generateReadyCSS(filteredIssues);

      try {
        await navigator.clipboard.writeText(JSON.stringify(fixesObject, null, 2));
        
        const typeLabels = {
          'all': 'всех проблем',
          'critical': 'критических проблем',
          'non-critical': 'предупреждений и рекомендаций'
        };
        
        this.showNotification(`✅ Объект ${typeLabels[filterType]} скопирован в буфер обмена!`, 'success');
        
        // Также выводим в консоль для удобства
        console.group(`📋 Copied Typography Fixes - ${title}`);
        console.log(`Скопирован объект с ${filteredIssues.length} проблемами:`);
        console.log(fixesObject);
        
        console.log('\n🎯 Быстрое применение CSS:');
        console.log(fixesObject.readyToApplyCSS);
        
        console.log('\n💡 Рекомендуемый порядок исправления:');
        fixesObject.fixes.forEach(fix => {
          console.log(`${fix.id}. [${fix.severity.toUpperCase()}] ${fix.type} - ${fix.elementsCount} элементов (~${fix.estimatedTime})`);
        });
        
        console.groupEnd();
        
      } catch (err) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = JSON.stringify(fixesObject, null, 2);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        this.showNotification(`📋 Объект ${typeLabels[filterType]} скопирован (fallback)`, 'success');
        console.log(`Typography Fixes - ${title}:`, fixesObject);
      }
    },

    // Получение приоритета серьезности
    getSeverityPriority(severity) {
      const priorities = { critical: 1, warning: 2, info: 3 };
      return priorities[severity] || 4;
    },

    // Получение порядка приоритетов
    getPriorityOrder(filterType) {
      const orders = {
        'critical': ['Сначала исправить критические проблемы - они влияют на читаемость'],
        'non-critical': ['Предупреждения и рекомендации для улучшения типографики'],
        'all': [
          '1. Критические проблемы (влияют на читаемость)',
          '2. Предупреждения (улучшают качество)',
          '3. Рекомендации (консистентность)'
        ]
      };
      return orders[filterType] || orders['all'];
    },

    // Оценка времени на исправление
    getEstimatedFixTime(issueType) {
      const times = {
        'line-height-too-small': '2-5 мин',
        'line-height-too-large': '2-5 мин',
        'extreme-font-weight': '1-3 мин',
        'mixed-font-families': '5-10 мин',
        'redundant-style': '10-15 мин',
        'non-standard-size': '3-7 мин'
      };
      return times[issueType] || '5 мин';
    },

    // Генерация CSS правила
    generateCSSRule(selector, suggestedCSS) {
      if (typeof suggestedCSS === 'string') {
        return `${selector} { ${suggestedCSS} }`;
      }
      
      const rules = Object.entries(suggestedCSS)
        .map(([prop, value]) => `  ${prop}: ${value};`)
        .join('\n');
      
      return `${selector} {\n${rules}\n}`;
    },

    // Генерация готового CSS
    generateReadyCSS(filteredIssues) {
      let css = '/* Typography Fixes - Generated by Typography Analyzer */\n\n';
      
      const groupedBySelector = new Map();
      
      filteredIssues.forEach(issue => {
        issue.fixes.forEach(fix => {
          if (!groupedBySelector.has(fix.selector)) {
            groupedBySelector.set(fix.selector, {
              element: fix.element,
              path: fix.path,
              rules: new Map()
            });
          }
          
          const selectorData = groupedBySelector.get(fix.selector);
          
          if (typeof fix.suggestedCSS === 'object') {
            Object.entries(fix.suggestedCSS).forEach(([prop, value]) => {
              selectorData.rules.set(prop, value);
            });
          }
        });
      });
      
      groupedBySelector.forEach((data, selector) => {
        if (data.rules.size > 0) {
          css += `/* ${data.element} - ${data.path} */\n`;
          css += `${selector} {\n`;
          data.rules.forEach((value, prop) => {
            css += `  ${prop}: ${value};\n`;
          });
          css += '}\n\n';
        }
      });
      
      return css;
    },

    // Показ уведомлений
    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#00cc66' : '#0066cc'};
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 14px;
        z-index: 10001;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        animation: slideInDown 0.3s ease;
      `;
      
      notification.textContent = message;
      document.body.appendChild(notification);
      
      // Добавляем CSS анимацию
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
      
      // Убираем через 3 секунды
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    },

    // Подсветка элементов
    highlightElements(elements, issueIndex) {
      this.clearHighlights();
      
      elements.forEach((element, index) => {
        const overlay = document.createElement('div');
        overlay.className = 'typography-highlight';
        overlay.style.cssText = `
          position: absolute;
          pointer-events: none;
          background: rgba(255, 0, 150, 0.3);
          border: 2px solid #ff0096;
          border-radius: 4px;
          z-index: 9999;
          transition: all 0.3s ease;
        `;
        
        const rect = element.getBoundingClientRect();
        overlay.style.top = (rect.top + window.scrollY) + 'px';
        overlay.style.left = (rect.left + window.scrollX) + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        
        // Добавляем номер элемента
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute;
          top: -8px;
          left: -2px;
          background: #ff0096;
          color: white;
          padding: 2px 6px;
          font-size: 10px;
          border-radius: 3px;
          font-weight: bold;
        `;
        label.textContent = `${index + 1}`;
        overlay.appendChild(label);
        
        document.body.appendChild(overlay);
        this.state.highlightedElements.add(overlay);
        
        // Плавное появление
        setTimeout(() => {
          overlay.style.background = 'rgba(255, 0, 150, 0.15)';
        }, index * 100);
      });
      
      // Скролл к первому элементу
      if (elements.length > 0) {
        elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },

    // Очистка подсветки
    clearHighlights() {
      this.state.highlightedElements.forEach(overlay => {
        overlay.remove();
      });
      this.state.highlightedElements.clear();
    },

   // Цвет по важности
    getSeverityColor(severity) {
      const colors = {
        critical: '#ff4444',
        warning: '#ffaa00',
        info: '#44aaff'
      };
      return colors[severity] || '#666';
    },

    // Экспорт в консоль
    exportToConsole() {
      console.group('🔍 Typography Analysis Report');
      
      // Группировка по важности
      ['critical', 'warning', 'info'].forEach(severity => {
        const issues = this.state.issues.filter(i => i.severity === severity);
        if (issues.length > 0) {
          console.group(`${severity.toUpperCase()} Issues (${issues.length})`);
          
          issues.forEach(issue => {
            console.log(`${issue.type}: ${issue.description}`);
            console.table(issue.elements.map(el => ({
              Tag: el.tagName.toLowerCase(),
              Classes: el.className || '(none)',
              Text: el.textContent?.trim().substring(0, 30) || '(empty)',
              Details: JSON.stringify(issue.details)
            })));
          });
          
          console.groupEnd();
        }
      });
      
      // Общая статистика
      console.log('\n📊 Statistics:');
      console.table({
        'Total Font Combinations': this.state.fontMap.size,
        'Critical Issues': this.state.issues.filter(i => i.severity === 'critical').length,
        'Warnings': this.state.issues.filter(i => i.severity === 'warning').length,
        'Info': this.state.issues.filter(i => i.severity === 'info').length
      });
      
      console.groupEnd();
    },

    // Очистка и завершение работы
    cleanup() {
      this.clearHighlights();
      const container = document.getElementById('typography-analyzer-results');
      if (container) {
        container.remove();
      }
    },

    // Главный метод запуска
    run() {
      console.log('🚀 Starting Typography Analysis...');
      
      // Очищаем предыдущие результаты
      this.state.fontMap.clear();
      this.state.issues = [];
      this.state.fixableIssues = [];
      this.cleanup();
      
      // Запускаем анализ
      this.collectTypographyData();
      this.analyzeIssues();
      
      if (this.state.issues.length === 0) {
        console.log('✅ Typography Analysis Complete: No critical issues found!');
        this.showNotification('✅ Отличная работа! Критических проблем с типографикой не обнаружено.', 'success');
        return;
      }
      
      this.createInteractiveTable();
      console.log(`📋 Analysis complete. Found ${this.state.issues.length} issues to review.`);
    }
  };

  // Запуск анализатора
  TYPOGRAPHY_ANALYZER.run();
})();
