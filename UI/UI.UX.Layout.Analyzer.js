(() => {
  'use strict';
  
  const UI_UX_ANALYZER = {
    // Конфигурация для анализа
    config: {
      semanticElements: ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'],
      landmarkRoles: ['banner', 'navigation', 'main', 'search', 'complementary', 'contentinfo'],
      flexboxIssues: {
        maxFlexShrink: 1,
        minFlexBasis: 0,
        suspiciousFlexValues: ['999', '9999', '100%']
      },
      layoutElements: ['div', 'span', 'section', 'article'],
      accessibilityRequired: ['img', 'input', 'button', 'a'],
      headingOrder: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      maxNestingDepth: 10
    },

    // Состояние анализатора
    state: {
      layoutMap: new Map(),
      semanticStructure: [],
      flexboxElements: new Map(),
      issues: [],
      highlightedElements: new Set(),
      fixableIssues: [],
      pageStructure: {
        hasHeader: false,
        hasNav: false,
        hasMain: false,
        hasFooter: false,
        headingHierarchy: []
      }
    },

    // Сбор данных о структуре и лейауте
    collectLayoutData() {
      const allElements = document.querySelectorAll('*:not(script):not(style):not(meta):not(link)');
      
      allElements.forEach(element => {
        // Пропускаем невидимые элементы
        if (element.offsetParent === null && element.tagName !== 'HTML') return;
        
        const computedStyle = getComputedStyle(element);
        const tagName = element.tagName.toLowerCase();
        
        // Анализ flexbox элементов
        if (computedStyle.display === 'flex' || computedStyle.display === 'inline-flex') {
          this.analyzeFlexContainer(element, computedStyle);
        }
        
        // Анализ flex items
        if (element.parentElement && getComputedStyle(element.parentElement).display.includes('flex')) {
          this.analyzeFlexItem(element, computedStyle);
        }
        
        // Анализ семантической структуры
        this.analyzeSemantic(element);
        
        // Анализ заголовков
        if (element.tagName.match(/^H[1-6]$/)) {
          this.state.pageStructure.headingHierarchy.push({
            level: parseInt(element.tagName.charAt(1)),
            text: element.textContent?.trim().substring(0, 50) || '',
            element: element
          });
        }
        
        // Анализ лейаута
        const layoutData = {
          element: element,
          tagName: tagName,
          className: element.className,
          display: computedStyle.display,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex,
          overflow: computedStyle.overflow,
          width: computedStyle.width,
          height: computedStyle.height,
          margin: computedStyle.margin,
          padding: computedStyle.padding,
          nestingLevel: this.getNestingLevel(element)
        };
        
        const key = `${tagName}|${layoutData.display}|${layoutData.position}`;
        
        if (!this.state.layoutMap.has(key)) {
          this.state.layoutMap.set(key, {
            data: layoutData,
            elements: [],
            count: 0
          });
        }
        
        const entry = this.state.layoutMap.get(key);
        entry.elements.push(element);
        entry.count++;
      });
    },

    // Анализ flex контейнера
    analyzeFlexContainer(element, computedStyle) {
      const flexData = {
        element: element,
        display: computedStyle.display,
        flexDirection: computedStyle.flexDirection,
        flexWrap: computedStyle.flexWrap,
        justifyContent: computedStyle.justifyContent,
        alignItems: computedStyle.alignItems,
        alignContent: computedStyle.alignContent,
        gap: computedStyle.gap,
        children: Array.from(element.children)
      };
      
      this.state.flexboxElements.set(element, flexData);
    },

    // Анализ flex элемента
    analyzeFlexItem(element, computedStyle) {
      const parent = element.parentElement;
      if (!this.state.flexboxElements.has(parent)) return;
      
      const flexItemData = {
        flexGrow: computedStyle.flexGrow,
        flexShrink: computedStyle.flexShrink,
        flexBasis: computedStyle.flexBasis,
        alignSelf: computedStyle.alignSelf,
        order: computedStyle.order
      };
      
      // Добавляем данные к родительскому flex контейнеру
      const parentData = this.state.flexboxElements.get(parent);
      if (!parentData.items) parentData.items = new Map();
      parentData.items.set(element, flexItemData);
    },

    // Анализ семантической структуры
    analyzeSemantic(element) {
      const tagName = element.tagName.toLowerCase();
      
      // Отмечаем наличие ключевых элементов
      if (tagName === 'header') this.state.pageStructure.hasHeader = true;
      if (tagName === 'nav') this.state.pageStructure.hasNav = true;
      if (tagName === 'main') this.state.pageStructure.hasMain = true;
      if (tagName === 'footer') this.state.pageStructure.hasFooter = true;
      
      // Собираем семантическую структуру
      if (this.config.semanticElements.includes(tagName)) {
        this.state.semanticStructure.push({
          element: element,
          tagName: tagName,
          role: element.getAttribute('role'),
          hasLandmarkRole: this.config.landmarkRoles.includes(element.getAttribute('role')),
          nestingLevel: this.getNestingLevel(element),
          hasProperHeading: this.hasProperHeading(element)
        });
      }
    },

    // Получение уровня вложенности
    getNestingLevel(element) {
      let level = 0;
      let current = element.parentElement;
      while (current && current !== document.body) {
        level++;
        current = current.parentElement;
      }
      return level;
    },

    // Проверка правильности заголовков в секции
    hasProperHeading(element) {
      const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return headings.length > 0;
    },

    // Анализ проблем
    analyzeIssues() {
      this.analyzeSemanticIssues();
      this.analyzeFlexboxIssues();
      this.analyzeLayoutIssues();
      this.analyzeAccessibilityIssues();
      this.analyzeHeadingHierarchy();
    },

    // Анализ семантических проблем
    analyzeSemanticIssues() {
      // Проверка основной структуры страницы
      if (!this.state.pageStructure.hasHeader) {
        this.addIssue('warning', '🏗️ Отсутствует header', 
          'Страница должна иметь семантический элемент <header>', 
          [], { recommendation: 'Добавить <header> для шапки сайта' });
          
        this.createFixableIssue('missing-header', 'warning', [], 
          {}, 
          { element: '<header>', placement: 'top of body' },
          'Отсутствует семантический элемент <header>. Рекомендуется для структурирования шапки сайта.');
      }

      if (!this.state.pageStructure.hasMain) {
        this.addIssue('critical', '🎯 Отсутствует main', 
          'Страница должна иметь единственный элемент <main>', 
          [], { recommendation: 'Добавить <main> для основного контента' });
          
        this.createFixableIssue('missing-main', 'critical', [], 
          {}, 
          { element: '<main>', placement: 'wrap main content' },
          'Критически важно: отсутствует элемент <main>. Необходим для доступности и семантики.');
      }

      if (!this.state.pageStructure.hasFooter) {
        this.addIssue('warning', '🦶 Отсутствует footer', 
          'Рекомендуется использовать <footer> для подвала', 
          [], { recommendation: 'Добавить <footer> для информации о сайте' });
          
        this.createFixableIssue('missing-footer', 'warning', [], 
          {}, 
          { element: '<footer>', placement: 'bottom of body' },
          'Отсутствует семантический элемент <footer>. Рекомендуется для подвала сайта.');
      }

      // Анализ неправильного использования div вместо семантических элементов
      const suspiciousDivs = document.querySelectorAll('div[class*="header"], div[class*="nav"], div[class*="footer"], div[class*="main"], div[class*="sidebar"], div[id*="header"], div[id*="nav"], div[id*="footer"], div[id*="main"]');
      
      if (suspiciousDivs.length > 0) {
        const elements = Array.from(suspiciousDivs);
        this.addIssue('warning', '🏷️ Div вместо семантики', 
          `Найдено ${elements.length} div элементов, которые могли бы быть семантическими`, 
          elements, { recommendation: 'Заменить на семантические элементы' });
          
        elements.forEach(element => {
          const suggestedTag = this.suggestSemanticTag(element);
          this.createFixableIssue('semantic-div-replacement', 'warning', [element],
            { 'current-tag': 'div' },
            { 'suggested-tag': suggestedTag },
            `Элемент div с классом/id "${element.className || element.id}" следует заменить на семантический элемент.`);
        });
      }

      // Анализ семантических элементов без заголовков
      this.state.semanticStructure.forEach(semantic => {
        if (['section', 'article', 'aside'].includes(semantic.tagName) && !semantic.hasProperHeading) {
          this.addIssue('warning', '📝 Секция без заголовка', 
            `${semantic.tagName} не содержит заголовок`, 
            [semantic.element], { recommendation: 'Добавить заголовок в секцию' });
            
          this.createFixableIssue('section-without-heading', 'warning', [semantic.element],
            { 'missing': 'heading' },
            { 'add': 'h2, h3, h4, h5, или h6' },
            `Семантический элемент <${semantic.tagName}> должен содержать заголовок для лучшей структуры.`);
        }
      });
    },

    // Предложение семантического тега
    suggestSemanticTag(element) {
      const classId = (element.className + ' ' + element.id).toLowerCase();
      
      if (classId.includes('header') || classId.includes('head')) return 'header';
      if (classId.includes('nav') || classId.includes('menu')) return 'nav';
      if (classId.includes('main') || classId.includes('content')) return 'main';
      if (classId.includes('footer') || classId.includes('foot')) return 'footer';
      if (classId.includes('sidebar') || classId.includes('aside')) return 'aside';
      if (classId.includes('article') || classId.includes('post')) return 'article';
      if (classId.includes('section')) return 'section';
      
      return 'section';
    },

    // Анализ Flexbox проблем
    analyzeFlexboxIssues() {
      this.state.flexboxElements.forEach((flexData, container) => {
        // Проверка отсутствия gap при необходимости
        if (flexData.children.length > 1 && (!flexData.gap || flexData.gap === '0px')) {
          this.addIssue('info', '📏 Отсутствует gap', 
            'Flex контейнер без промежутков между элементами', 
            [container], { suggestion: 'Рассмотрите использование gap' });
            
          this.createFixableIssue('missing-flex-gap', 'info', [container],
            { 'gap': 'none' },
            { 'gap': '1rem' },
            'Flex контейнер с несколькими детьми без gap. Рекомендуется для лучшего визуального разделения.');
        }

        // Анализ flex items
        if (flexData.items) {
          flexData.items.forEach((itemData, item) => {
            // Проблемы с flex-shrink
            const flexShrink = parseFloat(itemData.flexShrink);
            if (flexShrink > this.config.flexboxIssues.maxFlexShrink) {
              this.addIssue('warning', '📉 Высокий flex-shrink', 
                `flex-shrink: ${flexShrink} может привести к нежелательному сжатию`, 
                [item], { currentValue: flexShrink });
                
              this.createFixableIssue('high-flex-shrink', 'warning', [item],
                { 'flex-shrink': itemData.flexShrink },
                { 'flex-shrink': '1' },
                `Высокое значение flex-shrink (${flexShrink}) может привести к чрезмерному сжатию элемента.`);
            }

            // Проблемы с flex-grow
            const flexGrow = parseFloat(itemData.flexGrow);
            if (flexGrow > 10) {
              this.addIssue('warning', '📈 Экстремальный flex-grow', 
                `flex-grow: ${flexGrow} - подозрительно высокое значение`, 
                [item], { currentValue: flexGrow });
                
              this.createFixableIssue('extreme-flex-grow', 'warning', [item],
                { 'flex-grow': itemData.flexGrow },
                { 'flex-grow': '1' },
                `Экстремально высокое значение flex-grow (${flexGrow}). Обычно достаточно значений 0-3.`);
            }

            // Проблемы с order
            const order = parseInt(itemData.order);
            if (order !== 0 && Math.abs(order) > 10) {
              this.addIssue('warning', '🔀 Экстремальный order', 
                `order: ${order} может нарушить логический порядок`, 
                [item], { currentValue: order, accessibility: 'risk' });
                
              this.createFixableIssue('extreme-flex-order', 'warning', [item],
                { 'order': itemData.order },
                { 'order': '0' },
                `Экстремальное значение order (${order}) может нарушить логический порядок для скрин-ридеров.`);
            }
          });
        }

        // Анализ выравнивания
        if (flexData.alignItems === 'stretch' && flexData.flexDirection === 'row') {
          const hasHeightConstraints = flexData.children.some(child => {
            const style = getComputedStyle(child);
            return style.height !== 'auto' && style.minHeight !== '0px';
          });
          
          if (!hasHeightConstraints) {
            this.addIssue('info', '🔍 Проверить stretch', 
              'align-items: stretch без ограничений высоты', 
              [container], { suggestion: 'Проверить визуальный результат' });
          }
        }
      });
    },

    // Анализ общих проблем лейаута
    analyzeLayoutIssues() {
      // Анализ чрезмерной вложенности
      this.state.layoutMap.forEach((data, key) => {
        data.elements.forEach(element => {
          if (data.data.nestingLevel > this.config.maxNestingDepth) {
            this.addIssue('warning', '🏗️ Глубокая вложенность', 
              `Уровень вложенности: ${data.data.nestingLevel}`, 
              [element], { level: data.data.nestingLevel });
              
            this.createFixableIssue('deep-nesting', 'warning', [element],
              { 'nesting-level': data.data.nestingLevel },
              { 'recommendation': 'refactor structure' },
              `Слишком глубокая вложенность (${data.data.nestingLevel} уровней). Может усложнить поддержку CSS.`);
          }
        });
      });

      // Анализ position: fixed без z-index
      const fixedElements = document.querySelectorAll('*');
      Array.from(fixedElements).forEach(element => {
        const style = getComputedStyle(element);
        if (style.position === 'fixed' && style.zIndex === 'auto') {
          this.addIssue('warning', '📌 Fixed без z-index', 
            'Элемент position: fixed без явного z-index', 
            [element], { recommendation: 'Добавить z-index' });
            
          this.createFixableIssue('fixed-without-z-index', 'warning', [element],
            { 'z-index': 'auto' },
            { 'z-index': '1000' },
            'Элемент с position: fixed должен иметь явное значение z-index для предсказуемого поведения.');
        }
      });

      // Анализ overflow: hidden на важных контейнерах
      const hiddenOverflow = document.querySelectorAll('main, section, article');
      Array.from(hiddenOverflow).forEach(element => {
        const style = getComputedStyle(element);
        if (style.overflow === 'hidden' && !element.classList.contains('carousel') && !element.classList.contains('slider')) {
          this.addIssue('warning', '🙈 Скрытый overflow', 
            'overflow: hidden на семантическом контейнере', 
            [element], { warning: 'Может скрывать важный контент' });
            
          this.createFixableIssue('semantic-overflow-hidden', 'warning', [element],
            { 'overflow': 'hidden' },
            { 'overflow': 'visible' },
            'Семантический контейнер с overflow: hidden. Убедитесь, что это не скрывает важный контент.');
        }
      });
    },

    // Анализ доступности
    analyzeAccessibilityIssues() {
      // Изображения без alt
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
      if (imagesWithoutAlt.length > 0) {
        const elements = Array.from(imagesWithoutAlt);
        this.addIssue('critical', '🖼️ Изображения без alt', 
          `${elements.length} изображений без атрибута alt`, 
          elements, { accessibility: 'critical' });
          
        elements.forEach(element => {
          this.createFixableIssue('missing-alt-text', 'critical', [element],
            { 'alt': 'missing' },
            { 'alt': 'Описание изображения' },
            'Изображение без alt атрибута. Критично для доступности.');
        });
      }

      // Кнопки без текста или aria-label
      const buttonsWithoutText = document.querySelectorAll('button');
      Array.from(buttonsWithoutText).forEach(button => {
        const hasText = button.textContent?.trim();
        const hasAriaLabel = button.getAttribute('aria-label');
        const hasAriaLabelledBy = button.getAttribute('aria-labelledby');
        
        if (!hasText && !hasAriaLabel && !hasAriaLabelledBy) {
          this.addIssue('critical', '🔘 Кнопка без подписи', 
            'Кнопка без текста или aria-label', 
            [button], { accessibility: 'critical' });
            
          this.createFixableIssue('button-without-label', 'critical', [button],
            { 'aria-label': 'missing', 'text': 'empty' },
            { 'aria-label': 'Описание действия' },
            'Кнопка без доступного имени. Добавьте текст или aria-label.');
        }
      });

      // Ссылки без текста
      const linksWithoutText = document.querySelectorAll('a');
      Array.from(linksWithoutText).forEach(link => {
        const hasText = link.textContent?.trim();
        const hasAriaLabel = link.getAttribute('aria-label');
        
        if (!hasText && !hasAriaLabel) {
          this.addIssue('critical', '🔗 Ссылка без текста', 
            'Ссылка без доступного имени', 
            [link], { accessibility: 'critical' });
            
          this.createFixableIssue('link-without-text', 'critical', [link],
            { 'accessible-name': 'missing' },
            { 'aria-label': 'Описание ссылки' },
            'Ссылка без доступного имени. Добавьте текст или aria-label.');
        }
      });

      // Проверка контрастности для элементов с фоном
      const elementsWithBackground = document.querySelectorAll('[style*="background"], [class*="bg-"]');
      if (elementsWithBackground.length > 0) {
        this.addIssue('info', '🎨 Проверить контраст', 
          `Найдено ${elementsWithBackground.length} элементов с фоном`, 
          Array.from(elementsWithBackground), { accessibility: 'check manually' });
      }
    },

    // Анализ иерархии заголовков
    analyzeHeadingHierarchy() {
      if (this.state.pageStructure.headingHierarchy.length === 0) {
        this.addIssue('warning', '📰 Нет заголовков', 
          'Страница не содержит заголовков', 
          [], { accessibility: 'important' });
        return;
      }

      // Проверка начала с H1
      const firstHeading = this.state.pageStructure.headingHierarchy[0];
      if (firstHeading.level !== 1) {
        this.addIssue('warning', '🏆 Первый заголовок не H1', 
          `Первый заголовок имеет уровень H${firstHeading.level}`, 
          [firstHeading.element], { recommendation: 'Начните с H1' });
          
        this.createFixableIssue('first-heading-not-h1', 'warning', [firstHeading.element],
          { 'current-level': `h${firstHeading.level}` },
          { 'suggested-level': 'h1' },
          'Первый заголовок на странице должен быть H1 для правильной иерархии.');
      }

      // Проверка пропусков в иерархии
      for (let i = 1; i < this.state.pageStructure.headingHierarchy.length; i++) {
        const current = this.state.pageStructure.headingHierarchy[i];
        const previous = this.state.pageStructure.headingHierarchy[i - 1];
        
        if (current.level > previous.level + 1) {
          this.addIssue('warning', '⚡ Пропуск в иерархии', 
            `Переход с H${previous.level} на H${current.level}`, 
            [current.element], { previous: previous.level, current: current.level });
            
          this.createFixableIssue('heading-hierarchy-skip', 'warning', [current.element],
            { 'current-level': `h${current.level}` },
            { 'suggested-level': `h${previous.level + 1}` },
            `Пропуск в иерархии заголовков: с H${previous.level} сразу на H${current.level}.`);
        }
      }

      // Проверка множественных H1
      const h1Count = this.state.pageStructure.headingHierarchy.filter(h => h.level === 1).length;
      if (h1Count > 1) {
        const h1Elements = this.state.pageStructure.headingHierarchy
          .filter(h => h.level === 1)
          .map(h => h.element);
          
        this.addIssue('warning', '🎯 Множественные H1', 
          `Найдено ${h1Count} заголовков H1`, 
          h1Elements, { recommendation: 'Оставить только один H1' });
      }
    },

    // Создание объекта с исправлениями
    createFixableIssue(type, severity, elements, currentValues, suggestedFix, reasoning) {
      const fixes = elements.map(element => ({
        selector: this.generateSelector(element),
        tagName: element.tagName.toLowerCase(),
        className: element.className || null,
        id: element.id || null,
        textPreview: element.textContent?.trim().substring(0, 30) || '(empty)',
        currentValues: currentValues,
        suggestedFix: suggestedFix,
        elementPath: this.getElementPath(element)
      }));

      this.state.fixableIssues.push({
        issueType: type,
        severity: severity,
        description: reasoning,
        affectedElements: fixes.length,
        fixes: fixes,
        category: this.getCategoryByType(type)
      });
    },

    // Получение категории по типу проблемы
    getCategoryByType(type) {
      const categories = {
        'missing-header': 'semantic',
        'missing-main': 'semantic',
        'missing-footer': 'semantic',
        'semantic-div-replacement': 'semantic',
        'section-without-heading': 'semantic',
        'missing-flex-gap': 'flexbox',
        'high-flex-shrink': 'flexbox',
        'extreme-flex-grow': 'flexbox',
        'extreme-flex-order': 'flexbox',
        'deep-nesting': 'structure',
        'fixed-without-z-index': 'layout',
        'semantic-overflow-hidden': 'layout',
        'missing-alt-text': 'accessibility',
        'button-without-label': 'accessibility',
        'link-without-text': 'accessibility',
        'first-heading-not-h1': 'structure',
        'heading-hierarchy-skip': 'structure'
      };
      return categories[type] || 'other';
    },

    // Генерация селектора для элемента
    generateSelector(element) {
      let selector = element.tagName.toLowerCase();
      
      if (element.id) {
        return `#${element.id}`;
      }
      
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/);
        if (classes.length > 0 && classes[0] !== '') {
          selector += '.' + classes.join('.');
        }
      }
      
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
      const container = document.createElement('div');
      container.id = 'ui-ux-analyzer-results';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        width: 600px;
        max-height: 75vh;
        background: #1a1a2e;
        border: 2px solid #16213e;
        border-radius: 12px;
        color: #fff;
font-family: 'SF Mono', Consolas, monospace;
        font-size: 12px;
        z-index: 10000;
        overflow-y: auto;
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        backdrop-filter: blur(10px);
      `;

      // Header
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-bottom: 1px solid #444;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 10px 10px 0 0;
      `;
      header.innerHTML = `
        <span>🎨 UI/UX Layout Analyzer</span>
        <button id="close-ui-analyzer" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;opacity:0.8;">✕</button>
      `;

      // Stats with categories
      const stats = document.createElement('div');
      stats.style.cssText = 'padding: 16px 20px; background: #2a2a3e; border-bottom: 1px solid #444;';
      
      const categoryStats = this.getCategoryStats();
      const totalIssues = this.state.issues.length;
      const criticalIssues = this.state.issues.filter(i => i.severity === 'critical').length;
      const warningIssues = this.state.issues.filter(i => i.severity === 'warning').length;
      const infoIssues = this.state.issues.filter(i => i.severity === 'info').length;
      
      stats.innerHTML = `
        <div style="margin-bottom: 8px;">
          📊 Всего проблем: ${totalIssues} | 
          🚨 Критических: ${criticalIssues} |
          ⚠️ Предупреждений: ${warningIssues} |
          💡 Рекомендаций: ${infoIssues}
        </div>
        <div style="font-size: 11px; color: #ccc;">
          🏗️ Структура: ${categoryStats.structure} | 
          🎯 Семантика: ${categoryStats.semantic} | 
          📐 Flexbox: ${categoryStats.flexbox} | 
          ♿ Доступность: ${categoryStats.accessibility}
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: #aaa;">
          🏆 H1: ${this.state.pageStructure.headingHierarchy.filter(h => h.level === 1).length} | 
          📝 Заголовки: ${this.state.pageStructure.headingHierarchy.length} |
          🏠 Структура: ${this.state.pageStructure.hasHeader ? '✓' : '✗'}Header ${this.state.pageStructure.hasMain ? '✓' : '✗'}Main ${this.state.pageStructure.hasFooter ? '✓' : '✗'}Footer
        </div>
      `;

      // Filter tabs
      const filterTabs = document.createElement('div');
      filterTabs.style.cssText = `
        display: flex; 
        background: #333; 
        border-bottom: 1px solid #444;
        overflow-x: auto;
      `;
      
      const filters = [
        { name: 'all', label: 'Все', icon: '📋' },
        { name: 'critical', label: 'Критические', icon: '🚨' },
        { name: 'semantic', label: 'Семантика', icon: '🏷️' },
        { name: 'flexbox', label: 'Flexbox', icon: '📐' },
        { name: 'accessibility', label: 'Доступность', icon: '♿' },
        { name: 'structure', label: 'Структура', icon: '🏗️' }
      ];
      
      filters.forEach(filter => {
        const tab = document.createElement('button');
        tab.style.cssText = `
          padding: 10px 16px;
          border: none;
          background: transparent;
          color: #ccc;
          cursor: pointer;
          font-size: 11px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
          white-space: nowrap;
        `;
        tab.innerHTML = `${filter.icon} ${filter.label}`;
        tab.dataset.filter = filter.name;
        
        if (filter.name === 'all') {
          tab.style.color = '#fff';
          tab.style.borderBottomColor = '#667eea';
        }
        
        tab.addEventListener('click', () => this.filterIssues(filter.name, tab));
        filterTabs.appendChild(tab);
      });

      // Table container
      const tableContainer = document.createElement('div');
      tableContainer.id = 'issues-container';
      tableContainer.style.cssText = 'padding: 12px; max-height: 400px; overflow-y: auto;';
      
      this.renderIssues(tableContainer, 'all');

      // Controls with enhanced copy options
      const controls = document.createElement('div');
      controls.style.cssText = 'padding: 16px 20px; background: #333; border-top: 1px solid #444; border-radius: 0 0 10px 10px;';
      
      const fixableStats = this.getFixableStats();
      
      controls.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="clear-ui-highlights" style="background:#444;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
            🧹 Очистить
          </button>
          <button id="export-ui-report" style="background:#0066cc;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
            📊 Консоль
          </button>
          <button id="analyze-performance" style="background:#6366f1;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
            ⚡ Производительность
          </button>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 8px;">
          <button id="copy-all-ui-fixes" style="background:#00cc66;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            📋 Все (${fixableStats.all})
          </button>
          <button id="copy-critical-ui-fixes" style="background:#ff4444;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            🚨 Критические (${fixableStats.critical})
          </button>
          <button id="copy-semantic-fixes" style="background:#8b5cf6;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            🏷️ Семантика (${fixableStats.semantic})
          </button>
          <button id="copy-a11y-fixes" style="background:#f59e0b;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            ♿ A11Y (${fixableStats.accessibility})
          </button>
        </div>
        
        <div style="font-size: 10px; color: #888; text-align: center;">
          💡 Кликните на проблему для подсветки элементов
        </div>
      `;

      // Assembly
      container.appendChild(header);
      container.appendChild(stats);
      container.appendChild(filterTabs);
      container.appendChild(tableContainer);
      container.appendChild(controls);

      // Event listeners
      this.setupEventListeners(container);

      document.body.appendChild(container);
    },

    // Получение статистики по категориям
    getCategoryStats() {
      const stats = { semantic: 0, flexbox: 0, accessibility: 0, structure: 0, layout: 0, other: 0 };
      
      this.state.fixableIssues.forEach(issue => {
        const category = issue.category || 'other';
        stats[category] = (stats[category] || 0) + 1;
      });
      
      return stats;
    },

    // Получение статистики исправлений
    getFixableStats() {
      return {
        all: this.state.fixableIssues.length,
        critical: this.state.fixableIssues.filter(i => i.severity === 'critical').length,
        semantic: this.state.fixableIssues.filter(i => i.category === 'semantic').length,
        accessibility: this.state.fixableIssues.filter(i => i.category === 'accessibility').length
      };
    },

    // Рендеринг проблем с фильтрацией
    renderIssues(container, filterType) {
      container.innerHTML = '';
      
      let filteredIssues = this.state.issues;
      
      switch (filterType) {
        case 'critical':
          filteredIssues = this.state.issues.filter(i => i.severity === 'critical');
          break;
        case 'semantic':
          filteredIssues = this.state.issues.filter(i => 
            i.type.includes('header') || i.type.includes('main') || i.type.includes('footer') || 
            i.type.includes('семантик') || i.type.includes('Div вместо')
          );
          break;
        case 'flexbox':
          filteredIssues = this.state.issues.filter(i => 
            i.type.includes('flex') || i.type.includes('gap') || i.type.includes('order')
          );
          break;
        case 'accessibility':
          filteredIssues = this.state.issues.filter(i => 
            i.type.includes('alt') || i.type.includes('Кнопка') || i.type.includes('Ссылка') ||
            i.type.includes('контраст') || i.details?.accessibility
          );
          break;
        case 'structure':
          filteredIssues = this.state.issues.filter(i => 
            i.type.includes('заголовок') || i.type.includes('иерархи') || i.type.includes('вложенность')
          );
          break;
      }

      if (filteredIssues.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = `
          padding: 40px 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        `;
        emptyState.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
          <div>Отличная работа!</div>
          <div style="font-size: 12px; margin-top: 8px;">
            Проблем типа "${filterType}" не обнаружено
          </div>
        `;
        container.appendChild(emptyState);
        return;
      }
      
      filteredIssues.forEach((issue, index) => {
        const row = document.createElement('div');
        row.style.cssText = `
          padding: 12px 16px;
          margin: 6px 0;
          border-left: 4px solid ${this.getSeverityColor(issue.severity)};
          background: linear-gradient(135deg, #2a2a3e 0%, #3a3a4e 100%);
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.3s ease;
          position: relative;
        `;
        
        // Priority badge
        const priorityBadge = this.getPriorityBadge(issue.severity);
        
        row.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div style="font-weight: bold; font-size: 13px;">
              ${issue.type}
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${priorityBadge}
              <span style="color: #888; font-size: 11px;">${issue.count} элементов</span>
            </div>
          </div>
          
          <div style="color: #ccc; font-size: 12px; margin-bottom: 8px; line-height: 1.4;">
            ${issue.description}
          </div>
          
          ${this.getIssueDetails(issue)}
          
          <div style="color: #888; font-size: 10px; margin-top: 8px; font-style: italic;">
            💡 Клик для подсветки • Hover для предпросмотра
          </div>
        `;

        // Enhanced interactions
        row.addEventListener('click', () => this.highlightElements(issue.elements, index));
        row.addEventListener('mouseenter', () => {
          row.style.background = 'linear-gradient(135deg, #3a3a4e 0%, #4a4a5e 100%)';
          row.style.transform = 'translateY(-2px)';
          row.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = 'linear-gradient(135deg, #2a2a3e 0%, #3a3a4e 100%)';
          row.style.transform = 'translateY(0)';
          row.style.boxShadow = 'none';
        });

        container.appendChild(row);
      });
    },

    // Получение бейджа приоритета
    getPriorityBadge(severity) {
      const badges = {
        critical: '<span style="background:#ff4444;color:#fff;padding:2px 6px;border-radius:12px;font-size:9px;font-weight:bold;">КРИТИЧНО</span>',
        warning: '<span style="background:#ffaa00;color:#000;padding:2px 6px;border-radius:12px;font-size:9px;font-weight:bold;">ВНИМАНИЕ</span>',
        info: '<span style="background:#44aaff;color:#fff;padding:2px 6px;border-radius:12px;font-size:9px;font-weight:bold;">ИНФО</span>'
      };
      return badges[severity] || '';
    },

    // Получение деталей проблемы
    getIssueDetails(issue) {
      if (!issue.details) return '';
      
      let details = [];
      
      if (issue.details.recommendation) {
        details.push(`💡 ${issue.details.recommendation}`);
      }
      
      if (issue.details.accessibility) {
        const a11yLevel = issue.details.accessibility === 'critical' ? '🚨' : '♿';
        details.push(`${a11yLevel} Доступность: ${issue.details.accessibility}`);
      }
      
      if (issue.details.currentValue !== undefined) {
        details.push(`📊 Текущее значение: ${issue.details.currentValue}`);
      }
      
      if (details.length === 0) return '';
      
      return `
        <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; margin: 6px 0;">
          <div style="font-size: 11px; color: #ddd;">
            ${details.join(' • ')}
          </div>
        </div>
      `;
    },

    // Фильтрация проблем
    filterIssues(filterType, activeTab) {
      // Update active tab
      document.querySelectorAll('[data-filter]').forEach(tab => {
        tab.style.color = '#ccc';
        tab.style.borderBottomColor = 'transparent';
      });
      
      activeTab.style.color = '#fff';
      activeTab.style.borderBottomColor = '#667eea';
      
      // Re-render issues
      const container = document.getElementById('issues-container');
      this.renderIssues(container, filterType);
    },

    // Настройка обработчиков событий
    setupEventListeners(container) {
      // Close button
      container.querySelector('#close-ui-analyzer').addEventListener('click', () => {
        this.cleanup();
      });
      
      // Clear highlights
      container.querySelector('#clear-ui-highlights').addEventListener('click', () => {
        this.clearHighlights();
      });
      
      // Export to console
      container.querySelector('#export-ui-report').addEventListener('click', () => {
        this.exportToConsole();
      });
      
      // Performance analysis
      container.querySelector('#analyze-performance').addEventListener('click', () => {
        this.analyzePerformance();
      });

      // Copy buttons
      container.querySelector('#copy-all-ui-fixes').addEventListener('click', () => {
        this.copyFixesToClipboard('all');
      });

      container.querySelector('#copy-critical-ui-fixes').addEventListener('click', () => {
        this.copyFixesToClipboard('critical');
      });

      container.querySelector('#copy-semantic-fixes').addEventListener('click', () => {
        this.copyFixesToClipboard('semantic');
      });

      container.querySelector('#copy-a11y-fixes').addEventListener('click', () => {
        this.copyFixesToClipboard('accessibility');
      });
    },

    // Копирование исправлений в буфер обмена
    async copyFixesToClipboard(filterType = 'all') {
      let filteredIssues;
      let title;
      
      switch (filterType) {
        case 'critical':
          filteredIssues = this.state.fixableIssues.filter(issue => issue.severity === 'critical');
          title = 'КРИТИЧЕСКИЕ ПРОБЛЕМЫ UI/UX';
          break;
        case 'semantic':
          filteredIssues = this.state.fixableIssues.filter(issue => issue.category === 'semantic');
          title = 'ПРОБЛЕМЫ СЕМАНТИКИ';
          break;
        case 'accessibility':
          filteredIssues = this.state.fixableIssues.filter(issue => issue.category === 'accessibility');
          title = 'ПРОБЛЕМЫ ДОСТУПНОСТИ';
          break;
        default:
          filteredIssues = this.state.fixableIssues;
          title = 'ВСЕ ПРОБЛЕМЫ UI/UX';
      }

      if (filteredIssues.length === 0) {
        this.showNotification(`❌ Нет проблем типа "${filterType}" для копирования`, 'info');
        return;
      }

      const fixesObject = {
        title: `🎨 UI/UX Layout Analyzer - ${title}`,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        filterType: filterType,
        pageStructure: {
          hasHeader: this.state.pageStructure.hasHeader,
          hasMain: this.state.pageStructure.hasMain,
          hasFooter: this.state.pageStructure.hasFooter,
          hasNav: this.state.pageStructure.hasNav,
          headingsCount: this.state.pageStructure.headingHierarchy.length,
          h1Count: this.state.pageStructure.headingHierarchy.filter(h => h.level === 1).length
        },
        summary: {
          totalIssues: filteredIssues.length,
          byCategory: this.getCategorySummary(filteredIssues),
          bySeverity: {
            critical: filteredIssues.filter(i => i.severity === 'critical').length,
            warning: filteredIssues.filter(i => i.severity === 'warning').length,
            info: filteredIssues.filter(i => i.severity === 'info').length
          },
          affectedElements: filteredIssues.reduce((sum, issue) => sum + issue.affectedElements, 0)
        },
        priorityGuide: this.getPriorityGuide(filterType),
        fixes: filteredIssues
          .sort((a, b) => this.getSeverityPriority(a.severity) - this.getSeverityPriority(b.severity))
          .map((issue, index) => ({
            id: index + 1,
            type: issue.issueType,
            category: issue.category,
            severity: issue.severity,
            priority: this.getSeverityPriority(issue.severity),
            description: issue.description,
            elementsCount: issue.affectedElements,
            estimatedTime: this.getEstimatedFixTime(issue.issueType),
            impact: this.getImpactLevel(issue.issueType),
            fixes: issue.fixes.map((fix, fixIndex) => ({
              id: `${index + 1}.${fixIndex + 1}`,
              selector: fix.selector,
              element: `${fix.tagName}${fix.className ? '.' + fix.className.split(' ').join('.') : ''}${fix.id ? '#' + fix.id : ''}`,
              textContent: fix.textPreview,
              path: fix.elementPath,
              currentValues: fix.currentValues,
              suggestedFix: fix.suggestedFix,
              htmlFix: this.generateHTMLFix(fix),
              cssFix: this.generateCSSFix(fix)
            }))
          }))
      };

      // Добавляем готовые решения
      fixesObject.readyToApply = {
        html: this.generateReadyHTML(filteredIssues),
        css: this.generateReadyCSS(filteredIssues),
        javascript: this.generateReadyJS(filteredIssues)
      };

      try {
        await navigator.clipboard.writeText(JSON.stringify(fixesObject, null, 2));
        
        const typeLabels = {
          'all': 'всех проблем UI/UX',
          'critical': 'критических проблем',
          'semantic': 'проблем семантики',
          'accessibility': 'проблем доступности'
        };
        
        this.showNotification(`✅ ${typeLabels[filterType]} скопировано!`, 'success');
        
        // Console output
        console.group(`📋 UI/UX Fixes - ${title}`);
        console.log(`Скопирован объект с ${filteredIssues.length} проблемами:`, fixesObject);
        
        console.log('\n🎯 Быстрые решения:');
        console.log('HTML:', fixesObject.readyToApply.html);
        console.log('CSS:', fixesObject.readyToApply.css);
        console.log('JS:', fixesObject.readyToApply.javascript);
        
        console.groupEnd();
        
      } catch (err) {
        // Fallback
        console.error('Clipboard error:', err);
        this.showNotification(`📋 Объект скопирован в консоль`, 'info');
        console.log(`UI/UX Fixes - ${title}:`, fixesObject);
      }
    },

    // Получение сводки по категориям
    getCategorySummary(filteredIssues) {
      const summary = {};
      filteredIssues.forEach(issue => {
        const cat = issue.category || 'other';
        summary[cat] = (summary[cat] || 0) + 1;
      });
      return summary;
    },

    // Получение приоритета серьезности
    getSeverityPriority(severity) {
      const priorities = { critical: 1, warning: 2, info: 3 };
      return priorities[severity] || 4;
    },

    // Получение руководства по приоритетам
    getPriorityGuide(filterType) {
      const guides = {
        'critical': [
          '1. Критические проблемы влияют на доступность и функциональность',
          '2. Исправляйте проблемы с alt текстом и aria-label в первую очередь',
          '3. Убедитесь в наличии элемента <main> для семантики'
        ],
        'semantic': [
          '1. Замените div на семантические элементы где возможно',
          '2. Добавьте отсутствующие <header>, <main>, <footer>',
          '3. Убедитесь что секции содержат заголовки'
        ],
        'accessibility': [
          '1. Добавьте alt атрибуты ко всем изображениям',
          '2. Убедитесь что интерактивные элементы имеют доступные имена',
          '3. Проверьте контрастность цветов'
        ],
        'all': [
          '1. Начните с критических проблем доступности',
          '2. Исправьте семантическую структуру',
          '3. Оптимизируйте flexbox лейауты',
          '4. Улучшите общую структуру'
        ]
      };
      return guides[filterType] || guides['all'];
    },

    // Оценка времени исправления
    getEstimatedFixTime(issueType) {
      const times = {
        'missing-header': '5-10 мин',
        'missing-main': '10-15 мин',
        'missing-footer': '5-10 мин',
        'semantic-div-replacement': '15-30 мин',
        'missing-alt-text': '2-5 мин',
        'button-without-label': '3-7 мин',
        'link-without-text': '3-7 мин',
        'missing-flex-gap': '2-3 мин',
        'high-flex-shrink': '1-2 мин',
        'extreme-flex-grow': '1-2 мин',
        'first-heading-not-h1': '2-5 мин',
        'heading-hierarchy-skip': '5-10 мин'
      };
      return times[issueType] || '5-15 мин';
    },

    // Получение уровня воздействия
    getImpactLevel(issueType) {
      const impacts = {
        'missing-main': 'Высокий - SEO и доступность',
        'missing-alt-text': 'Критический - Доступность',
        'button-without-label': 'Критический - Доступность',
        'semantic-div-replacement': 'Средний - SEO и семантика',
        'missing-flex-gap': 'Низкий - Визуальное улучшение',
        'first-heading-not-h1': 'Средний - SEO структура'
      };
      return impacts[issueType] || 'Средний';
    },

    // Генерация HTML исправления
    generateHTMLFix(fix) {
      if (typeof fix.suggestedFix === 'object' && fix.suggestedFix.element) {
        return `<!-- Заменить -->\n<${fix.suggestedFix.element}>\n  <!-- Контент -->\n</${fix.suggestedFix.element}>`;
      }
      
      if (fix.currentValues && fix.currentValues.alt === 'missing') {
        return `<img src="..." alt="${fix.suggestedFix['alt'] || 'Описание изображения'}" />`;
      }
      
      return `<!-- HTML изменения для ${fix.selector} -->`;
    },

    // Генерация CSS исправления
    generateCSSFix(fix) {
      if (typeof fix.suggestedFix === 'object' && !fix.suggestedFix.element) {
        const rules = Object.entries(fix.suggestedFix)
          .map(([prop, value]) => `  ${prop}: ${value};`)
          .join('\n');
        return `${fix.selector} {\n${rules}\n}`;
      }
      return `/* CSS правила для ${fix.selector} */`;
    },

    // Генерация готового HTML
    generateReadyHTML(filteredIssues) {
      let html = '<!-- UI/UX Improvements - Generated by UI/UX Analyzer -->\n\n';
      
      // Проверяем отсутствующие семантические элементы
      const missingElements = filteredIssues.filter(issue => 
        ['missing-header', 'missing-main', 'missing-footer'].includes(issue.issueType)
      );
      
      if (missingElements.length > 0) {
        html += '<!-- Добавить в структуру страницы: -->\n';
        missingElements.forEach(issue => {
          const element = issue.issueType.replace('missing-', '');
          html += `<${element}>\n  <!-- ${element} контент -->\n</${element}>\n\n`;
        });
      }
      
      return html;
    },

    // Генерация готового CSS
    generateReadyCSS(filteredIssues) {
      let css = '/* UI/UX Layout Fixes - Generated by UI/UX Analyzer */\n\n';
      
      const cssIssues = filteredIssues.filter(issue => 
        ['missing-flex-gap', 'high-flex-shrink', 'extreme-flex-grow'].includes(issue.issueType)
      );
      
      cssIssues.forEach(issue => {
        issue.fixes.forEach(fix => {
          css += this.generateCSSFix(fix) + '\n\n';
        });
      });
      
      return css;
    },

    // Генерация готового JS
    generateReadyJS(filteredIssues) {
      let js = '// UI/UX Accessibility Fixes - Generated by UI/UX Analyzer\n\n';
      
      const a11yIssues = filteredIssues.filter(issue => 
        ['missing-alt-text', 'button-without-label', 'link-without-text'].includes(issue.issueType)
      );
      
      if (a11yIssues.length > 0) {
        js += '// Исправление проблем доступности\n';
        js += 'document.addEventListener("DOMContentLoaded", function() {\n';
        
        a11yIssues.forEach(issue => {
          issue.fixes.forEach(fix => {
if (fix.currentValues && fix.currentValues.alt === 'missing') {
              js += `  // Добавление alt текста для изображения\n`;
              js += `  const img = document.querySelector('${fix.selector}');\n`;
              js += `  if (img) img.setAttribute('alt', '${fix.suggestedFix.alt || 'Описание изображения'}');\n\n`;
            }
            
            if (fix.currentValues && fix.currentValues['aria-label'] === 'missing') {
              js += `  // Добавление aria-label для элемента\n`;
              js += `  const element = document.querySelector('${fix.selector}');\n`;
              js += `  if (element) element.setAttribute('aria-label', '${fix.suggestedFix['aria-label'] || 'Описание действия'}');\n\n`;
            }
          });
        });
        
        js += '});\n\n';
      }
      
      return js;
    },

    // Анализ производительности
    analyzePerformance() {
      console.group('⚡ Performance Analysis');
      
      // Анализ DOM
      const allElements = document.querySelectorAll('*').length;
      const depthAnalysis = this.analyzeDepth();
      const flexboxCount = this.state.flexboxElements.size;
      
      console.log('📊 DOM Statistics:');
      console.table({
        'Total Elements': allElements,
        'Max Nesting Depth': depthAnalysis.maxDepth,
        'Deep Elements (>10)': depthAnalysis.deepElements,
        'Flexbox Containers': flexboxCount,
        'Semantic Elements': this.state.semanticStructure.length
      });
      
      // Анализ потенциальных проблем производительности
      const performanceIssues = [];
      
      if (allElements > 3000) {
        performanceIssues.push('🚨 Много DOM элементов (>3000) - может влиять на производительность');
      }
      
      if (depthAnalysis.deepElements > 5) {
        performanceIssues.push('⚠️ Глубокая вложенность DOM - усложняет CSS селекторы');
      }
      
      // Анализ CSS сложности
      const expensiveSelectors = this.findExpensiveSelectors();
      if (expensiveSelectors.length > 0) {
        performanceIssues.push(`📐 Найдено ${expensiveSelectors.length} потенциально медленных селекторов`);
      }
      
      if (performanceIssues.length > 0) {
        console.log('⚠️ Performance Issues:');
        performanceIssues.forEach(issue => console.log(issue));
      } else {
        console.log('✅ Производительность DOM выглядит хорошо!');
      }
      
      // Рекомендации
      console.log('\n💡 Recommendations:');
      console.log('• Используйте CSS Grid/Flexbox вместо сложных float лейаутов');
      console.log('• Избегайте глубокой вложенности (>10 уровней)');
      console.log('• Используйте семантические элементы для лучшего SEO');
      console.log('• Проверьте доступность с помощью скрин-ридеров');
      
      console.groupEnd();
      
      this.showNotification('📊 Анализ производительности выведен в консоль', 'info');
    },

    // Анализ глубины вложенности
    analyzeDepth() {
      let maxDepth = 0;
      let deepElements = 0;
      
      document.querySelectorAll('*').forEach(element => {
        const depth = this.getNestingLevel(element);
        if (depth > maxDepth) maxDepth = depth;
        if (depth > 10) deepElements++;
      });
      
      return { maxDepth, deepElements };
    },

    // Поиск дорогих селекторов
    findExpensiveSelectors() {
      const expensive = [];
      
      // Проверяем инлайн стили
      document.querySelectorAll('[style]').forEach(element => {
        if (element.style.cssText.length > 200) {
          expensive.push(`Длинный inline стиль: ${element.tagName.toLowerCase()}`);
        }
      });
      
      // Проверяем классы с множественными селекторами
      document.querySelectorAll('[class]').forEach(element => {
        const classes = element.className.split(' ');
        if (classes.length > 10) {
          expensive.push(`Много классов: ${element.tagName.toLowerCase()} (${classes.length})`);
        }
      });
      
      return expensive;
    },

    // Подсветка элементов с улучшенной анимацией
    highlightElements(elements, issueIndex) {
      this.clearHighlights();
      
      if (elements.length === 0) {
        this.showNotification('🔍 Нет элементов для подсветки', 'info');
        return;
      }
      
      elements.forEach((element, index) => {
        const overlay = document.createElement('div');
        overlay.className = 'ui-ux-highlight';
        overlay.style.cssText = `
          position: absolute;
          pointer-events: none;
          background: rgba(102, 126, 234, 0.25);
          border: 2px solid #667eea;
          border-radius: 6px;
          z-index: 9999;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          animation: pulse 2s infinite;
        `;
        
        const rect = element.getBoundingClientRect();
        overlay.style.top = (rect.top + window.scrollY) + 'px';
        overlay.style.left = (rect.left + window.scrollX) + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        
        // Enhanced label with more info
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute;
          top: -32px;
          left: -2px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 6px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          z-index: 10000;
        `;
        
        const tagName = element.tagName.toLowerCase();
        const classList = element.className ? `.${element.className.split(' ')[0]}` : '';
        label.textContent = `${index + 1}. ${tagName}${classList}`;
        overlay.appendChild(label);
        
        // Add element info tooltip
        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
          position: absolute;
          top: -80px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          font-size: 10px;
          border-radius: 6px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          max-width: 250px;
        `;
        
        const textPreview = element.textContent?.trim().substring(0, 30) || '';
        tooltip.innerHTML = `
          <div><strong>${tagName.toUpperCase()}</strong></div>
          <div>Класс: ${element.className || 'нет'}</div>
          <div>Текст: ${textPreview || 'пусто'}</div>
        `;
        
        overlay.appendChild(tooltip);
        
        // Show tooltip on hover
        overlay.addEventListener('mouseenter', () => {
          tooltip.style.opacity = '1';
        });
        
        overlay.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
        });
        
        document.body.appendChild(overlay);
        this.state.highlightedElements.add(overlay);
        
        // Staggered animation
        setTimeout(() => {
          overlay.style.transform = 'scale(1.02)';
          setTimeout(() => {
            overlay.style.transform = 'scale(1)';
          }, 200);
        }, index * 100);
      });
      
      // Add pulse animation styles
      if (!document.getElementById('ui-ux-pulse-styles')) {
        const style = document.createElement('style');
        style.id = 'ui-ux-pulse-styles';
        style.textContent = `
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
            100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Scroll to first element with smooth animation
      if (elements.length > 0) {
        elements[0].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }
      
      this.showNotification(`🎯 Подсвечено ${elements.length} элементов`, 'info');
    },

    // Очистка подсветки
    clearHighlights() {
      this.state.highlightedElements.forEach(overlay => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 300);
      });
      this.state.highlightedElements.clear();
    },

    // Цвет по важности
    getSeverityColor(severity) {
      const colors = {
        critical: '#ff4757',
        warning: '#ffa502',
        info: '#3742fa'
      };
      return colors[severity] || '#666';
    },

    // Экспорт в консоль с детальной информацией
    exportToConsole() {
      console.group('🎨 UI/UX Layout Analysis Report');
      
      // Page Structure Overview
      console.group('🏗️ Page Structure');
      console.table({
        'Header': this.state.pageStructure.hasHeader ? '✅' : '❌',
        'Navigation': this.state.pageStructure.hasNav ? '✅' : '❌',
        'Main Content': this.state.pageStructure.hasMain ? '✅' : '❌',
        'Footer': this.state.pageStructure.hasFooter ? '✅' : '❌',
        'Total Headings': this.state.pageStructure.headingHierarchy.length,
        'H1 Count': this.state.pageStructure.headingHierarchy.filter(h => h.level === 1).length
      });
      console.groupEnd();

      // Issues by Category
      const categories = ['critical', 'warning', 'info'];
      categories.forEach(severity => {
        const issues = this.state.issues.filter(i => i.severity === severity);
        if (issues.length > 0) {
          console.group(`${severity.toUpperCase()} Issues (${issues.length})`);
          
          issues.forEach(issue => {
            console.log(`${issue.type}: ${issue.description}`);
            if (issue.elements.length > 0) {
              console.table(issue.elements.slice(0, 5).map(el => ({
                Tag: el.tagName.toLowerCase(),
                Classes: el.className || '(none)',
                ID: el.id || '(none)',
                Text: el.textContent?.trim().substring(0, 40) || '(empty)',
                Path: this.getElementPath(el)
              })));
            }
          });
          
          console.groupEnd();
        }
      });

      // Flexbox Analysis
      if (this.state.flexboxElements.size > 0) {
        console.group(`📐 Flexbox Analysis (${this.state.flexboxElements.size} containers)`);
        
        this.state.flexboxElements.forEach((data, container) => {
          console.log(`Container: ${container.tagName.toLowerCase()}${container.className ? '.' + container.className.split(' ')[0] : ''}`);
          console.table({
            'Direction': data.flexDirection,
            'Wrap': data.flexWrap,
            'Justify Content': data.justifyContent,
            'Align Items': data.alignItems,
            'Gap': data.gap || 'none',
            'Children Count': data.children.length
          });
        });
        
        console.groupEnd();
      }

      // Semantic Structure
      if (this.state.semanticStructure.length > 0) {
        console.group(`🏷️ Semantic Structure (${this.state.semanticStructure.length} elements)`);
        console.table(this.state.semanticStructure.map(s => ({
          Element: s.tagName,
          Role: s.role || 'none',
          'Has Heading': s.hasProperHeading ? '✅' : '❌',
          'Nesting Level': s.nestingLevel
        })));
        console.groupEnd();
      }

      // Statistics Summary
      console.log('\n📊 Summary Statistics:');
      console.table({
        'Total Issues': this.state.issues.length,
        'Critical': this.state.issues.filter(i => i.severity === 'critical').length,
        'Warnings': this.state.issues.filter(i => i.severity === 'warning').length,
        'Info': this.state.issues.filter(i => i.severity === 'info').length,
        'Flexbox Containers': this.state.flexboxElements.size,
        'Semantic Elements': this.state.semanticStructure.length,
        'Total DOM Elements': document.querySelectorAll('*').length
      });

      console.groupEnd();
      this.showNotification('📊 Детальный отчет выведен в консоль', 'success');
    },

    // Показ уведомлений с улучшенным дизайном
    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      
      const colors = {
        success: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
        info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        error: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)'
      };
      
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 13px;
        z-index: 10002;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 400px;
        text-align: center;
      `;
      
      notification.textContent = message;
      document.body.appendChild(notification);
      
      // Animate in
      requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(-50%) translateY(0)';
      });
      
      // Animate out and remove
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 400);
      }, 3500);
    },

    // Очистка и завершение работы
    cleanup() {
      this.clearHighlights();
      
      const container = document.getElementById('ui-ux-analyzer-results');
      if (container) {
        container.style.opacity = '0';
        container.style.transform = 'translateY(-20px)';
        setTimeout(() => {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }, 300);
      }
      
      // Remove pulse styles
      const pulseStyles = document.getElementById('ui-ux-pulse-styles');
      if (pulseStyles) {
        pulseStyles.remove();
      }
    },

    // Главный метод запуска
    run() {
      console.log('🚀 Starting UI/UX Layout Analysis...');
      
      // Show loading notification
      this.showNotification('🔍 Анализирую структуру и лейауты...', 'info');
      
      // Clear previous results
      this.state.layoutMap.clear();
      this.state.semanticStructure = [];
      this.state.flexboxElements.clear();
      this.state.issues = [];
      this.state.fixableIssues = [];
      this.state.pageStructure = {
        hasHeader: false,
        hasNav: false,
        hasMain: false,
        hasFooter: false,
        headingHierarchy: []
      };
      this.cleanup();
      
      // Run analysis
      try {
        this.collectLayoutData();
        this.analyzeIssues();
        
        setTimeout(() => {
          if (this.state.issues.length === 0) {
            console.log('✅ UI/UX Analysis Complete: No issues found!');
            this.showNotification('🎉 Отличная работа! Проблем с UI/UX не обнаружено.', 'success');
            return;
          }
          
          this.createInteractiveTable();
          console.log(`📋 UI/UX Analysis complete. Found ${this.state.issues.length} issues to review.`);
          
          // Success notification
          const criticalCount = this.state.issues.filter(i => i.severity === 'critical').length;
          const message = criticalCount > 0 
            ? `⚠️ Найдено ${this.state.issues.length} проблем (${criticalCount} критических)`
            : `📋 Найдено ${this.state.issues.length} улучшений для UI/UX`;
            
          this.showNotification(message, criticalCount > 0 ? 'warning' : 'info');
        }, 500);
        
      } catch (error) {
        console.error('UI/UX Analysis Error:', error);
        this.showNotification('❌ Ошибка при анализе UI/UX', 'error');
      }
    }
  };

  // Launch the analyzer
  UI_UX_ANALYZER.run();
})();
