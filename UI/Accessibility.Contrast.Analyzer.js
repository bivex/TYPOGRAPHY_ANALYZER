(() => {
    'use strict';

    const ACCESSIBILITY_ANALYZER = {
        // Конфигурация WCAG и доступности
        config: {
            wcag: {
                // Минимальные требования контраста WCAG
                contrastRatios: {
                    normalTextAA: 4.5, // WCAG AA для обычного текста
                    normalTextAAA: 7.0, // WCAG AAA для обычного текста
                    largeTextAA: 3.0, // WCAG AA для крупного текста (18pt+)
                    largeTextAAA: 4.5, // WCAG AAA для крупного текста
                    nonTextAA: 3.0, // WCAG AA для не-текстовых элементов
                    nonTextAAA: 4.5 // WCAG AAA для не-текстовых элементов
                },
                // Размеры текста для категоризации
                textSizes: {
                    large: 18, // pt
                    largeWeightBold: 14 // pt для жирного текста
                }
            },

            // Интерактивные элементы, требующие проверки фокуса
            focusableElements: [
                'a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])',
                'textarea:not([disabled])', 'button:not([disabled])', 'iframe',
                'object', 'embed', '[contenteditable]', '[tabindex]:not([tabindex="-1"])'
            ],

            // Обязательные ARIA роли для элементов
            requiredRoles: {
                'img': ['img', 'presentation', 'none'],
                'button': ['button', 'link', 'menuitem'],
                'a': ['link', 'button', 'tab', 'menuitem'],
                'input': ['textbox', 'searchbox', 'button', 'checkbox', 'radio'],
                'nav': ['navigation'],
                'main': ['main'],
                'header': ['banner'],
                'footer': ['contentinfo']
            },

            // Конфликтующие ARIA комбинации
            conflictingAria: {
                'aria-hidden': ['aria-label', 'aria-labelledby', 'aria-describedby'],
                'role=presentation': ['aria-label', 'aria-labelledby', 'aria-describedby'],
                'role=none': ['aria-label', 'aria-labelledby', 'aria-describedby']
            },

            // Минимальные размеры для касаний (WCAG 2.1)
            touchTargets: {
                minWidth: 44, // px
                minHeight: 44 // px
            }
        },

        // Состояние анализатора
        state: {
            contrastIssues: [],
            focusIssues: [],
            ariaIssues: [],
            keyboardIssues: [],
            readabilityIssues: [],
            allIssues: [],
            fixableIssues: [],
            highlightedElements: new Set(),
            wcagLevel: 'AA', // Текущий уровень проверки
            colorCache: new Map() // Кеш для цветовых вычислений
        },

        // Главный анализ доступности
        analyzeAccessibility() {
            console.log('🔍 Анализ доступности WCAG...');

            this.analyzeColorContrast();
            this.analyzeFocusability();
            this.analyzeKeyboardNavigation();
            this.analyzeAriaCompliance();
            this.analyzeReadability();
            this.analyzeTouchTargets();
            this.analyzeScreenReaderCompatibility();
        },

        // === АНАЛИЗ КОНТРАСТНОСТИ ЦВЕТОВ ===
        analyzeColorContrast() {
            console.log('🎨 Проверка контрастности...');

            const textElements = document.querySelectorAll('*');

            Array.from(textElements).forEach(element => {
                // Пропускаем элементы без текстового контента
                if (!element.textContent?.trim() || ['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD'].includes(element.tagName)) {
                    return;
                }

                // Пропускаем невидимые элементы
                if (element.offsetParent === null && element.tagName !== 'HTML') return;

                const computedStyle = getComputedStyle(element);

                // Получаем цвета
                const textColor = this.parseColor(computedStyle.color);
                const backgroundColor = this.getEffectiveBackgroundColor(element);

                if (!textColor || !backgroundColor) return;

                // Вычисляем контраст
                const contrastRatio = this.calculateContrastRatio(textColor, backgroundColor);
                const fontSize = this.getFontSizeInPt(computedStyle);
                const fontWeight = computedStyle.fontWeight;

                // Определяем требования для элемента
                const requirements = this.getContrastRequirements(fontSize, fontWeight, element);

                // Проверяем соответствие WCAG
                const wcagResults = this.checkWCAGCompliance(contrastRatio, requirements);

                if (!wcagResults.passAA || !wcagResults.passAAA) {
                    this.addContrastIssue(element, {
                        textColor,
                        backgroundColor,
                        contrastRatio,
                        fontSize,
                        fontWeight,
                        requirements,
                        wcagResults,
                        computedStyle
                    });
                }
            });
        },

        // Получение эффективного фона элемента
        getEffectiveBackgroundColor(element) {
            let current = element;

            while (current && current !== document.body) {
                const style = getComputedStyle(current);
                const bgColor = this.parseColor(style.backgroundColor);

                if (bgColor && bgColor.a > 0) {
                    // Если фон непрозрачный, возвращаем его
                    if (bgColor.a === 1) {
                        return bgColor;
                    }

                    // Если полупрозрачный, смешиваем с родительским
                    const parentBg = this.getEffectiveBackgroundColor(current.parentElement);
                    if (parentBg) {
                        return this.blendColors(bgColor, parentBg);
                    }
                }

                current = current.parentElement;
            }

            // По умолчанию белый фон
            return {
                r: 255,
                g: 255,
                b: 255,
                a: 1
            };
        },

        // Смешивание цветов для полупрозрачных элементов
        blendColors(foreground, background) {
            const alpha = foreground.a;
            const invAlpha = 1 - alpha;

            return {
                r: Math.round(foreground.r * alpha + background.r * invAlpha),
                g: Math.round(foreground.g * alpha + background.g * invAlpha),
                b: Math.round(foreground.b * alpha + background.b * invAlpha),
                a: 1
            };
        },

        // Парсинг CSS цвета в RGB
        parseColor(colorString) {
            if (this.state.colorCache.has(colorString)) {
                return this.state.colorCache.get(colorString);
            }

            // Создаем временный элемент для парсинга цвета
            const div = document.createElement('div');
            div.style.color = colorString;
            document.body.appendChild(div);

            const computed = getComputedStyle(div).color;
            document.body.removeChild(div);

            let result = null;

            // Парсим rgb/rgba
            const rgbMatch = computed.match(/rgba?\(([^)]+)\)/);
            if (rgbMatch) {
                const values = rgbMatch[1].split(',').map(v => parseFloat(v.trim()));
                result = {
                    r: values[0] || 0,
                    g: values[1] || 0,
                    b: values[2] || 0,
                    a: values[3] !== undefined ? values[3] : 1
                };
            }

            this.state.colorCache.set(colorString, result);
            return result;
        },

        // Вычисление коэффициента контрастности по WCAG
        calculateContrastRatio(color1, color2) {
            const l1 = this.getRelativeLuminance(color1);
            const l2 = this.getRelativeLuminance(color2);

            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);

            return (lighter + 0.05) / (darker + 0.05);
        },

        // Получение относительной яркости
        getRelativeLuminance(color) {
            const rsRGB = color.r / 255;
            const gsRGB = color.g / 255;
            const bsRGB = color.b / 255;

            const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
            const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
            const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        },

        // Получение размера шрифта в пунктах
        getFontSizeInPt(computedStyle) {
            const fontSize = parseFloat(computedStyle.fontSize);
            // Конвертируем px в pt (1pt = 4/3 px)
            return fontSize * 0.75;
        },

        // Определение требований контрастности для элемента
        getContrastRequirements(fontSize, fontWeight, element) {
            const isLargeText = fontSize >= this.config.wcag.textSizes.large ||
                (fontSize >= this.config.wcag.textSizes.largeWeightBold &&
                    (fontWeight === 'bold' || parseInt(fontWeight) >= 700));

            // Проверяем, является ли элемент не-текстовым (кнопки, иконки и т.д.)
            const isNonText = element.tagName === 'BUTTON' ||
                element.hasAttribute('role') && ['button', 'tab', 'menuitem'].includes(element.getAttribute('role'));

            if (isNonText) {
                return {
                    type: 'non-text',
                    aa: this.config.wcag.contrastRatios.nonTextAA,
                    aaa: this.config.wcag.contrastRatios.nonTextAAA
                };
            }

            if (isLargeText) {
                return {
                    type: 'large-text',
                    aa: this.config.wcag.contrastRatios.largeTextAA,
                    aaa: this.config.wcag.contrastRatios.largeTextAAA
                };
            }

            return {
                type: 'normal-text',
                aa: this.config.wcag.contrastRatios.normalTextAA,
                aaa: this.config.wcag.contrastRatios.normalTextAAA
            };
        },

        // Проверка соответствия WCAG
        checkWCAGCompliance(contrastRatio, requirements) {
            return {
                ratio: contrastRatio,
                passAA: contrastRatio >= requirements.aa,
                passAAA: contrastRatio >= requirements.aaa,
                requirements
            };
        },

        // === АНАЛИЗ ФОКУСИРУЕМОСТИ ===
        analyzeFocusability() {
            console.log('🎯 Проверка фокусируемости...');

            const focusableElements = document.querySelectorAll(
                this.config.focusableElements.join(',')
            );

            Array.from(focusableElements).forEach(element => {
                const computedStyle = getComputedStyle(element);
                const tabindex = element.getAttribute('tabindex');

                // Проверяем видимость outline при фокусе
                const hasVisibleOutline = this.checkFocusOutline(element);

                // Проверяем доступность с клавиатуры
                const isKeyboardAccessible = this.checkKeyboardAccessibility(element);

                // Проверяем размер области касания
                const touchTargetSize = this.getTouchTargetSize(element);

                if (!hasVisibleOutline || !isKeyboardAccessible || !touchTargetSize.adequate) {
                    this.addFocusIssue(element, {
                        hasVisibleOutline,
                        isKeyboardAccessible,
                        touchTargetSize,
                        tabindex,
                        computedStyle
                    });
                }
            });
        },

        // Проверка видимости outline при фокусе
        checkFocusOutline(element) {
            const style = getComputedStyle(element);

            // Проверяем outline
            const outlineWidth = style.outlineWidth;
            const outlineStyle = style.outlineStyle;
            const outlineColor = style.outlineColor;

            // Если outline явно отключен
            if (outlineStyle === 'none' || outlineWidth === '0px') {
                // Проверяем альтернативные способы индикации фокуса
                const hasBoxShadow = style.boxShadow && style.boxShadow !== 'none';
                const hasBorder = style.borderWidth && style.borderWidth !== '0px';
                const hasBackground = style.backgroundColor && style.backgroundColor !== 'transparent';

                return hasBoxShadow || hasBorder || hasBackground;
            }

            return true;
        },

        // Проверка доступности с клавиатуры
        checkKeyboardAccessibility(element) {
            const tabindex = element.getAttribute('tabindex');
            const role = element.getAttribute('role');
            const tagName = element.tagName.toLowerCase();

            // Элементы с tabindex="-1" не доступны с клавиатуры
            if (tabindex === '-1') {
                // Исключение для элементов, которые должны быть программно фокусируемыми
                const allowedRoles = ['dialog', 'alertdialog', 'menu', 'menubar'];
                if (!role || !allowedRoles.includes(role)) {
                    return false;
                }
            }

            // Интерактивные элементы без href или обработчиков событий
            if (tagName === 'a' && !element.href) {
                const hasClickHandler = element.onclick ||
                    element.addEventListener ||
                    element.getAttribute('onclick');
                return !!hasClickHandler;
            }

            return true;
        },

        // Получение размера области касания
        getTouchTargetSize(element) {
            const rect = element.getBoundingClientRect();
            const {
                minWidth,
                minHeight
            } = this.config.touchTargets;

            const adequate = rect.width >= minWidth && rect.height >= minHeight;

            return {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                adequate,
                requiredWidth: minWidth,
                requiredHeight: minHeight
            };
        },

        // === АНАЛИЗ НАВИГАЦИИ С КЛАВИАТУРЫ ===
        analyzeKeyboardNavigation() {
            console.log('⌨️ Проверка навигации с клавиатуры...');

            // Проверяем последовательность tabindex
            const tabbableElements = Array.from(document.querySelectorAll('[tabindex]'))
                .filter(el => el.getAttribute('tabindex') !== '-1')
                .sort((a, b) => {
                    const tabA = parseInt(a.getAttribute('tabindex')) || 0;
                    const tabB = parseInt(b.getAttribute('tabindex')) || 0;
                    return tabA - tabB;
                });

            // Проверяем логичность порядка табуляции
            this.checkTabOrder(tabbableElements);

            // Проверяем ловушки фокуса в модальных окнах
            this.checkFocusTraps();

            // Проверяем skip links
            this.checkSkipLinks();
        },

        // Проверка порядка табуляции
        checkTabOrder(elements) {
            let previousTabindex = 0;
            let hasLogicalOrder = true;

            elements.forEach((element, index) => {
                const tabindex = parseInt(element.getAttribute('tabindex')) || 0;

                // Пропуски в порядке табуляции могут создавать проблемы
                if (tabindex > 0 && tabindex !== previousTabindex + 1 && index > 0) {
                    hasLogicalOrder = false;
                }

                previousTabindex = tabindex;
            });

            if (!hasLogicalOrder && elements.length > 0) {
                this.addKeyboardIssue('tab-order', 'Нелогичный порядок табуляции', elements);
            }
        },

        // Проверка ловушек фокуса
        checkFocusTraps() {
            const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal');

            Array.from(modals).forEach(modal => {
                const isVisible = getComputedStyle(modal).display !== 'none';
                if (!isVisible) return;

                const focusableInModal = modal.querySelectorAll(
                    this.config.focusableElements.join(',')
                );

                if (focusableInModal.length === 0) {
                    this.addKeyboardIssue('focus-trap', 'Модальное окно без фокусируемых элементов', [modal]);
                }
            });
        },

        // Проверка skip links
        checkSkipLinks() {
            const skipLinks = document.querySelectorAll('a[href^="#"]:first-child, .skip-link, [class*="skip"]');

            if (skipLinks.length === 0) {
                this.addKeyboardIssue('skip-links', 'Отсутствуют skip links для навигации', []);
            }
        },

        // === АНАЛИЗ ARIA И СЕМАНТИКИ ===
        analyzeAriaCompliance() {
            console.log('🏷️ Проверка ARIA соответствия...');

            const allElements = document.querySelectorAll('*');

            Array.from(allElements).forEach(element => {
                this.checkAriaLabels(element);
                this.checkAriaRoles(element);
                this.checkAriaStates(element);
                this.checkAriaConflicts(element);
                this.checkRequiredAriaAttributes(element);
            });
        },

        // Проверка ARIA меток
        checkAriaLabels(element) {
            const tagName = element.tagName.toLowerCase();
            const role = element.getAttribute('role');

            // Элементы, требующие доступного имени
            const needsAccessibleName = [
                'button', 'a', 'input', 'textarea', 'select'
            ].includes(tagName) || ['button', 'link', 'textbox', 'combobox', 'listbox', 'tab', 'menuitem'].includes(role);

            if (needsAccessibleName) {
                const accessibleName = this.getAccessibleName(element);

                if (!accessibleName) {
                    this.addAriaIssue(element, 'missing-accessible-name',
                        `Элемент ${tagName} не имеет доступного имени`);
                }
            }
        },

        // Получение доступного имени элемента
        getAccessibleName(element) {
            // Проверяем в порядке приоритета согласно spec

            // aria-labelledby
            const labelledBy = element.getAttribute('aria-labelledby');
            if (labelledBy) {
                const referencedElements = labelledBy.split(' ')
                    .map(id => document.getElementById(id))
                    .filter(Boolean);

                if (referencedElements.length > 0) {
                    return referencedElements.map(el => el.textContent?.trim()).join(' ');
                }
            }

            // aria-label
            const ariaLabel = element.getAttribute('aria-label');
            if (ariaLabel?.trim()) {
                return ariaLabel.trim();
            }

            // Для input элементов - связанный label
            if (element.tagName === 'INPUT') {
                const id = element.id;
                if (id) {
                    const label = document.querySelector(`label[for="${id}"]`);
                    if (label) {
                        return label.textContent?.trim();
                    }
                }

                // Родительский label
                const parentLabel = element.closest('label');
                if (parentLabel) {
                    return parentLabel.textContent?.trim();
                }

                // placeholder как последний вариант
                const placeholder = element.getAttribute('placeholder');
                if (placeholder?.trim()) {
                    return placeholder.trim();
                }
            }

            // title атрибут
            const title = element.getAttribute('title');
            if (title?.trim()) {
                return title.trim();
            }

            // Текстовое содержимое
            const textContent = element.textContent?.trim();
            if (textContent) {
                return textContent;
            }

            return null;
        },

        // Проверка ARIA ролей
        checkAriaRoles(element) {
            const role = element.getAttribute('role');
            const tagName = element.tagName.toLowerCase();

            if (role) {
                // Проверяем валидность роли
                const validRoles = this.getValidAriaRoles();
                if (!validRoles.includes(role)) {
                    this.addAriaIssue(element, 'invalid-role',
                        `Недопустимая ARIA роль: ${role}`);
                }

                // Проверяем соответствие роли элементу
                const requiredRoles = this.config.requiredRoles[tagName];
                if (requiredRoles && !requiredRoles.includes(role)) {
                    this.addAriaIssue(element, 'inappropriate-role',
                        `Роль ${role} не подходит для элемента ${tagName}`);
                }
            }
        },

        // Получение списка валидных ARIA ролей
        getValidAriaRoles() {
            return [
                // Abstract roles (не используются напрямую)
                'command', 'composite', 'input', 'landmark', 'range', 'roletype', 'section',
                'sectionhead', 'select', 'structure', 'widget', 'window',

                // Widget roles
                'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
                'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo',
                'definition', 'dialog', 'directory', 'document', 'form', 'grid',
                'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox',
                'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar',
                'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'note',
                'option', 'presentation', 'progressbar', 'radio', 'radiogroup',
                'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
                'separator', 'slider', 'spinbutton', 'status', 'tab', 'tablist',
                'tabpanel', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
                'treegrid', 'treeitem', 'none'
            ];
        },

        // Проверка ARIA состояний
        checkAriaStates(element) {
            // Проверяем обязательные состояния для ролей
            const role = element.getAttribute('role') || this.getImplicitRole(element);

            const requiredStates = this.getRequiredAriaStates(role);

            requiredStates.forEach(state => {
                if (!element.hasAttribute(state)) {
                    this.addAriaIssue(element, 'missing-required-state',
                        `Отсутствует обязательный атрибут ${state} для роли ${role}`);
                }
            });
        },

        // Получение неявной роли элемента
        getImplicitRole(element) {
            const tagName = element.tagName.toLowerCase();
            const type = element.getAttribute('type');

            const implicitRoles = {
                'button': 'button',
                'a': element.href ? 'link' : null,
                'input': {
                    'button': 'button',
                    'checkbox': 'checkbox',
                    'radio': 'radio',
                    'range': 'slider',
                    'text': 'textbox',
                    'email': 'textbox',
                    'password': 'textbox',
                    'search': 'searchbox',
                    'tel': 'textbox',
                    'url': 'textbox'
                } [type] || 'textbox',
                'textarea': 'textbox',
                'select': 'combobox',
                'nav': 'navigation',
                'main': 'main',
                'header': 'banner',
                'footer': 'contentinfo',
                'aside': 'complementary',
                'section': 'region',
                'article': 'article',
                'form': 'form',
                'img': 'img',
                'h1': 'heading',
                'h2': 'heading',
                'h3': 'heading',
                'h4': 'heading',
                'h5': 'heading',
                'h6': 'heading'
            };

            return implicitRoles[tagName] || null;
        },

        // Получение обязательных ARIA состояний для роли
        getRequiredAriaStates(role) {
            const requiredStates = {
                'checkbox': ['aria-checked'],
                'radio': ['aria-checked'],
                'menuitemcheckbox': ['aria-checked'],
                'menuitemradio': ['aria-checked'],
                'option': ['aria-selected'],
                'tab': ['aria-selected'],
                'button': [], // Может требовать aria-pressed для toggle buttons
                'combobox': ['aria-expanded'],
                'listbox': ['aria-multiselectable'],
                'tree': ['aria-multiselectable'],
                'treegrid': ['aria-multiselectable'],
                'grid': ['aria-multiselectable'],
                'tablist': ['aria-orientation'],
                'slider': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
                'spinbutton': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
                'progressbar': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
                'scrollbar': ['aria-controls', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax']
            };

            return requiredStates[role] || [];
        },

        // Проверка конфликтов ARIA
        checkAriaConflicts(element) {
            Object.entries(this.config.conflictingAria).forEach(([attr, conflictingAttrs]) => {
                if (element.hasAttribute(attr) ||
                    (attr.startsWith('role=') && element.getAttribute('role') === attr.split('=')[1])) {

                    const conflicts = conflictingAttrs.filter(conflictAttr =>
                        element.hasAttribute(conflictAttr)
                    );

                    if (conflicts.length > 0) {
                        this.addAriaIssue(element, 'aria-conflict',
                            `Конфликт ARIA: ${attr} конфликтует с ${conflicts.join(', ')}`);
                    }
                }
            });
        },

        // Проверка обязательных ARIA атрибутов
        checkRequiredAriaAttributes(element) {
            const role = element.getAttribute('role');

            // Специальные проверки для конкретных ролей
            if (role === 'img' && !element.hasAttribute('alt') && !element.hasAttribute('aria-label')) {
                this.addAriaIssue(element, 'missing-image-description',
                    'Элемент с ролью img должен иметь alt или aria-label');
            }

            if (role === 'button' && element.hasAttribute('aria-pressed')) {
                const pressed = element.getAttribute('aria-pressed');
                if (!['true', 'false', 'mixed'].includes(pressed)) {
                    this.addAriaIssue(element, 'invalid-aria-value',
                        `Недопустимое значение aria-pressed: ${pressed}`);
                }
            }
        },

        // === АНАЛИЗ ЧИТАЕМОСТИ ===
        analyzeReadability() {
            console.log('📖 Анализ читаемости...');

            const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th');

            Array.from(textElements).forEach(element => {
                const text = element.textContent?.trim();
                if (!text || text.length < 10) return;

                const readabilityMetrics = this.calculateReadabilityMetrics(text, element);

                if (readabilityMetrics.hasIssues) {
                    this.addReadabilityIssue(element, readabilityMetrics);
                }
            });
        },

        // Вычисление метрик читаемости
        calculateReadabilityMetrics(text, element) {
            const style = getComputedStyle(element);
            const fontSize = parseFloat(style.fontSize);
            const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
            const letterSpacing = parseFloat(style.letterSpacing) || 0;

            // Анализ текста
            const words = text.split(/\s+/).filter(word => word.length > 0);
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
            const avgCharsPerWord = words.reduce((sum, word) => sum + word.length, 0) / words.length;

            // Проверка длины строк
            const lineLength = this.estimateLineLength(text, element);

            // Флеш индекс читаемости (упрощенный)
            const fleschScore = this.calculateFleschScore(words.length, sentences.length, text);

            const issues = [];
            let hasIssues = false;

            // Проверки читаемости
            if (avgWordsPerSentence > 25) {
                issues.push('Слишком длинные предложения (>25 слов)');
                hasIssues = true;
            }

            if (avgCharsPerWord > 7) {
                issues.push('Слишком сложные слова (средняя длина >7 символов)');
                hasIssues = true;
            }

            if (lineLength > 75) {
                issues.push('Слишком длинные строки (>75 символов)');
                hasIssues = true;
            }

            if (fontSize < 12) {
                issues.push('Слишком мелкий шрифт (<12px)');
                hasIssues = true;
            }

            const lineHeightRatio = lineHeight / fontSize;
            if (lineHeightRatio < 1.2) {
                issues.push('Недостаточный межстрочный интервал (<1.2)');
                hasIssues = true;
            }

            if (fleschScore < 30) {
                issues.push('Очень сложный для чтения текст (Flesch < 30)');
                hasIssues = true;
            } else if (fleschScore < 50) {
                issues.push('Сложный для чтения текст (Flesch < 50)');
                hasIssues = true;
            }

            return {
                hasIssues,
                issues,
                metrics: {
                    wordCount: words.length,
                    sentenceCount: sentences.length,
                    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
                    avgCharsPerWord: Math.round(avgCharsPerWord * 10) / 10,
                    lineLength,
                    fontSize,
                    lineHeight,
                    lineHeightRatio: Math.round(lineHeightRatio * 100) / 100,
                    fleschScore: Math.round(fleschScore)
                }
            };
        },

        // Оценка длины строки
        estimateLineLength(text, element) {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const fontSize = parseFloat(style.fontSize);

            // Примерная оценка: средняя ширина символа = fontSize * 0.6
            const avgCharWidth = fontSize * 0.6;
            const availableWidth = rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

            return Math.floor(availableWidth / avgCharWidth);
        },

        // Упрощенный расчет индекса Флеша
        calculateFleschScore(wordCount, sentenceCount, text) {
            if (sentenceCount === 0 || wordCount === 0) return 100;

            const avgSentenceLength = wordCount / sentenceCount;
            const syllableCount = this.estimateSyllables(text);
            const avgSyllablesPerWord = syllableCount / wordCount;

            return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
        },

        // Приблизительный подсчет слогов
        estimateSyllables(text) {
            const words = text.toLowerCase().match(/[а-яё]+/g) || [];
            let syllables = 0;

            words.forEach(word => {
                // Упрощенный подсчет слогов для русского языка
                const vowels = word.match(/[аеёиоуыэюя]/g) || [];
                syllables += Math.max(1, vowels.length);
            });

            return syllables;
        },

        // === АНАЛИЗ РАЗМЕРОВ КАСАНИЙ ===
        analyzeTouchTargets() {
            console.log('👆 Анализ размеров касаний...');

            const interactiveElements = document.querySelectorAll(
                'button, a, input, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick]'
            );

            Array.from(interactiveElements).forEach(element => {
                const size = this.getTouchTargetSize(element);

                if (!size.adequate) {
                    this.addTouchTargetIssue(element, size);
                }
            });
        },

        // === АНАЛИЗ СОВМЕСТИМОСТИ СО СКРИН-РИДЕРАМИ ===
        analyzeScreenReaderCompatibility() {
            console.log('🔊 Анализ совместимости со скрин-ридерами...');

            // Проверка структуры заголовков
            this.checkHeadingStructure();

            // Проверка списков
            this.checkListStructure();

            // Проверка таблиц
            this.checkTableStructure();

            // Проверка форм
            this.checkFormStructure();
        },

        // Проверка структуры заголовков
        checkHeadingStructure() {
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const headingLevels = Array.from(headings).map(h => ({
                level: parseInt(h.tagName.charAt(1)),
                element: h,
                text: h.textContent?.trim() || ''
            }));

            if (headingLevels.length === 0) {
                this.addScreenReaderIssue('no-headings', 'Страница не содержит заголовков', []);
                return;
            }

            // Проверка начала с H1
            if (headingLevels[0].level !== 1) {
                this.addScreenReaderIssue('no-h1-first',
                    'Первый заголовок не H1', [headingLevels[0].element]);
            }

            // Проверка пропусков в иерархии
            for (let i = 1; i < headingLevels.length; i++) {
                const current = headingLevels[i];
                const previous = headingLevels[i - 1];

                if (current.level > previous.level + 1) {
                    this.addScreenReaderIssue('heading-skip',
                        `Пропуск в иерархии: H${previous.level} → H${current.level}`,
                        [current.element]);
                }
            }

            // Проверка пустых заголовков
            headingLevels.forEach(heading => {
                if (!heading.text) {
                    this.addScreenReaderIssue('empty-heading',
                        'Пустой заголовок', [heading.element]);
                }
            });
        },

        // Проверка структуры списков
        checkListStructure() {
            const lists = document.querySelectorAll('ul, ol, dl');

            Array.from(lists).forEach(list => {
                const tagName = list.tagName.toLowerCase();
                let validChildren;

                if (tagName === 'ul' || tagName === 'ol') {
                    validChildren = list.querySelectorAll(':scope > li');
                    const allChildren = Array.from(list.children);
                    const invalidChildren = allChildren.filter(child => child.tagName !== 'LI');

                    if (invalidChildren.length > 0) {
                        this.addScreenReaderIssue('invalid-list-children',
                            `Список содержит недопустимые дочерние элементы`, [list]);
                    }

                    if (validChildren.length === 0) {
                        this.addScreenReaderIssue('empty-list', 'Пустой список', [list]);
                    }
                }

                if (tagName === 'dl') {
                    const terms = list.querySelectorAll('dt');
                    const definitions = list.querySelectorAll('dd');

                    if (terms.length === 0 || definitions.length === 0) {
                        this.addScreenReaderIssue('incomplete-definition-list',
                            'Неполный список определений (нет dt или dd)', [list]);
                    }
                }
            });
        },

        // Проверка структуры таблиц
        checkTableStructure() {
            const tables = document.querySelectorAll('table');

            Array.from(tables).forEach(table => {
                // Проверка заголовков таблицы
                const headers = table.querySelectorAll('th');
                const caption = table.querySelector('caption');

                if (headers.length === 0) {
                    this.addScreenReaderIssue('table-no-headers',
                        'Таблица без заголовков (th)', [table]);
                }

                if (!caption && !table.hasAttribute('aria-label') && !table.hasAttribute('aria-labelledby')) {
                    this.addScreenReaderIssue('table-no-caption',
                        'Таблица без описания (caption, aria-label или aria-labelledby)', [table]);
                }

                // Проверка scope атрибутов для сложных таблиц
                const complexTable = table.querySelectorAll('tr').length > 3 ||
                    table.querySelectorAll('th').length > 3;

                if (complexTable) {
                    const headersWithScope = table.querySelectorAll('th[scope]');
                    if (headersWithScope.length === 0) {
                        this.addScreenReaderIssue('table-missing-scope',
                            'Сложная таблица без scope атрибутов', [table]);
                    }
                }
            });
        },

        // Проверка структуры форм
        checkFormStructure() {
            const forms = document.querySelectorAll('form');

            Array.from(forms).forEach(form => {
                const inputs = form.querySelectorAll('input, textarea, select');

                Array.from(inputs).forEach(input => {
                    const type = input.type;

                    // Пропускаем hidden и submit элементы
                    if (type === 'hidden' || type === 'submit' || type === 'button') return;

                    const hasLabel = this.getAccessibleName(input);

                    if (!hasLabel) {
                        this.addScreenReaderIssue('input-no-label',
                            'Поле формы без подписи', [input]);
                    }

                    // Проверка группировки радиокнопок
                    if (type === 'radio') {
                        const name = input.name;
                        const radioGroup = form.querySelectorAll(`input[type="radio"][name="${name}"]`);
                        const fieldset = input.closest('fieldset');

                        if (radioGroup.length > 1 && !fieldset) {
                            this.addScreenReaderIssue('radio-no-fieldset',
                                'Группа радиокнопок без fieldset', [input]);
                        }
                    }
                });
            });
        },

        // === МЕТОДЫ ДОБАВЛЕНИЯ ПРОБЛЕМ ===
        addContrastIssue(element, data) {
            const severity = !data.wcagResults.passAA ? 'critical' : 'warning';
            const issueType = data.wcagResults.passAA ? 'contrast-aaa' : 'contrast-aa';

            this.state.contrastIssues.push({
                element,
                severity,
                type: 'contrast',
                data
            });

            this.createFixableIssue(
                issueType,
                severity,
                [element], {
                    'current-ratio': data.contrastRatio.toFixed(2),
                    'required-ratio': data.requirements.aa.toFixed(1),
                    'text-color': this.colorToHex(data.textColor),
                    'bg-color': this.colorToHex(data.backgroundColor)
                },
                this.suggestContrastFix(data),
                `Недостаточный контраст ${data.contrastRatio.toFixed(2)}:1. ${data.requirements.type === 'normal-text' ? 'Обычный текст' : data.requirements.type === 'large-text' ? 'Крупный текст' : 'Не-текстовый элемент'} требует минимум ${data.requirements.aa}:1 для WCAG AA.`
            );
        },

        addFocusIssue(element, data) {
            const severity = !data.hasVisibleOutline || !data.isKeyboardAccessible ? 'critical' : 'warning';

            this.state.focusIssues.push({
                element,
                severity,
                type: 'focus',
                data
            });

            let issues = [];
            if (!data.hasVisibleOutline) issues.push('нет видимого outline');
            if (!data.isKeyboardAccessible) issues.push('недоступен с клавиатуры');
            if (!data.touchTargetSize.adequate) issues.push('маленький размер касания');

            this.createFixableIssue(
                'focus-accessibility',
                severity,
                [element], {
                    'outline': data.hasVisibleOutline ? 'present' : 'missing',
                    'keyboard-accessible': data.isKeyboardAccessible ? 'yes' : 'no',
                    'touch-size': `${data.touchTargetSize.width}x${data.touchTargetSize.height}px`
                }, {
                    'outline': '2px solid #005fcc',
                    'min-width': '44px',
                    'min-height': '44px',
                    'cursor': 'pointer'
                },
                `Проблемы с фокусируемостью: ${issues.join(', ')}.`
            );
        },

        addAriaIssue(element, type, description) {
            const severity = ['missing-accessible-name', 'missing-required-state', 'aria-conflict'].includes(type) ? 'critical' : 'warning';

            this.state.ariaIssues.push({
                element,
                severity,
                type,
                description
            });

            this.createFixableIssue(
                type,
                severity,
                [element], {
                    issue: description
                },
                this.suggestAriaFix(element, type),
                description
            );
        },

        addKeyboardIssue(type, description, elements) {
            this.state.keyboardIssues.push({
                type,
                description,
                elements,
                severity: 'warning'
            });
        },

        addReadabilityIssue(element, metrics) {
            this.state.readabilityIssues.push({
                element,
                severity: 'info',
                type: 'readability',
                metrics
            });

            this.createFixableIssue(
                'readability-issues',
                'info',
                [element], {
                    'font-size': `${metrics.metrics.fontSize}px`,
                    'line-height': metrics.metrics.lineHeight,
                    'issues': metrics.issues.join('; ')
                }, {
                    'font-size': Math.max(14, metrics.metrics.fontSize) + 'px',
                    'line-height': Math.max(1.4, metrics.metrics.lineHeightRatio).toFixed(1),
                    'max-width': '75ch'
                },
                `Проблемы читаемости: ${metrics.issues.join(', ')}.`
            );
        },

        addTouchTargetIssue(element, size) {
            this.createFixableIssue(
                'touch-target-size',
                'warning',
                [element], {
                    'width': `${size.width}px`,
                    'height': `${size.height}px`
                }, {
                    'min-width': `${size.requiredWidth}px`,
                    'min-height': `${size.requiredHeight}px`,
                    'padding': '8px'
                },
                `Размер касания ${size.width}x${size.height}px меньше рекомендованного ${size.requiredWidth}x${size.requiredHeight}px.`
            );
        },

        addScreenReaderIssue(type, description, elements) {
            const severity = ['no-headings', 'input-no-label', 'table-no-headers'].includes(type) ? 'critical' : 'warning';

            this.state.allIssues.push({
                type: 'screen-reader',
                subType: type,
                description,
                elements,
                severity
            });
        },

        // === МЕТОДЫ ПРЕДЛОЖЕНИЯ ИСПРАВЛЕНИЙ ===
        suggestContrastFix(data) {
            const {
                textColor,
                backgroundColor,
                requirements
            } = data;
            const requiredRatio = requirements.aa;

            // Предлагаем изменение цвета текста или фона
            const darkerText = this.adjustColorForContrast(textColor, backgroundColor, requiredRatio, 'darken');
            const lighterBg = this.adjustColorForContrast(backgroundColor, textColor, requiredRatio, 'lighten');

            return {
                'color': this.colorToHex(darkerText),
                'background-color': this.colorToHex(lighterBg),
                'alternative-1': `color: ${this.colorToHex(darkerText)}`,
                'alternative-2': `background-color: ${this.colorToHex(lighterBg)}`
            };
        },

        suggestAriaFix(element, type) {
            const tagName = element.tagName.toLowerCase();

            const suggestions = {
                'missing-accessible-name': {
                    'aria-label': 'Описание элемента',
                    'alternative': tagName === 'input' ? 'Добавить <label>' : 'Добавить текстовое содержимое'
                },
                'missing-required-state': {
                    'aria-expanded': 'false',
                    'aria-checked': 'false',
                    'aria-selected': 'false'
                },
                'invalid-role': {
                    'remove-role': 'Удалить недопустимую роль',
                    'correct-role': this.getImplicitRole(element) || 'button'
                },
                'aria-conflict': {
                    'action': 'Удалить конфликтующие атрибуты'
                }
            };

            return suggestions[type] || {
                'review': 'Требуется ручная проверка'
            };
        },

        // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
        adjustColorForContrast(color, bgColor, targetRatio, direction) {
            let adjustedColor = {
                ...color
            };
            let currentRatio = this.calculateContrastRatio(adjustedColor, bgColor);

            const step = direction === 'darken' ? -10 : 10;
            let iterations = 0;
            const maxIterations = 25;

            while (currentRatio < targetRatio && iterations < maxIterations) {
                if (direction === 'darken') {
                    adjustedColor.r = Math.max(0, adjustedColor.r + step);
                    adjustedColor.g = Math.max(0, adjustedColor.g + step);
                    adjustedColor.b = Math.max(0, adjustedColor.b + step);
                } else {
                    adjustedColor.r = Math.min(255, adjustedColor.r + step);
                    adjustedColor.g = Math.min(255, adjustedColor.g + step);
                    adjustedColor.b = Math.min(255, adjustedColor.b + step);
                }

                currentRatio = this.calculateContrastRatio(adjustedColor, bgColor);
                iterations++;
            }

            return adjustedColor;
        },

        colorToHex(color) {
            const toHex = (n) => {
                const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };

            return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
        },

        createFixableIssue(type, severity, elements, currentValues, suggestedFix, reasoning) {
            const fixes = elements.map(element => ({
                selector: this.generateSelector(element),
                tagName: element.tagName.toLowerCase(),
                className: element.className || null,
                id: element.id || null,
                textPreview: element.textContent?.trim().substring(0, 30) || '(empty)',
                currentValues: currentValues,
                suggestedFix: suggestedFix,
                elementPath: this.getElementPath(element),
                wcagLevel: this.getWCAGLevel(type),
                impact: this.getAccessibilityImpact(type)
            }));

            this.state.fixableIssues.push({
                issueType: type,
                severity: severity,
                category: this.getAccessibilityCategory(type),
                description: reasoning,
                affectedElements: fixes.length,
                fixes: fixes,
                wcagCriteria: this.getWCAGCriteria(type),
                automationPossible: this.canAutomate(type)
            });
        },

        getWCAGLevel(type) {
            const levels = {
                'contrast-aa': 'AA',
                'contrast-aaa': 'AAA',
                'focus-accessibility': 'AA',
                'missing-accessible-name': 'A',
                'missing-required-state': 'A',
                'touch-target-size': 'AAA',
                'readability-issues': 'AAA'
            };
            return levels[type] || 'AA';
        },

        getAccessibilityImpact(type) {
            const impacts = {
                'contrast-aa': 'Высокий - пользователи с нарушениями зрения',
                'contrast-aaa': 'Средний - улучшенная читаемость',
                'focus-accessibility': 'Критический - навигация с клавиатуры',
                'missing-accessible-name': 'Критический - скрин-ридеры',
                'missing-required-state': 'Высокий - состояние элементов',
                'touch-target-size': 'Средний - мобильные пользователи',
                'readability-issues': 'Средний - когнитивная доступность'
            };
            return impacts[type] || 'Средний';
        },

        getAccessibilityCategory(type) {
            const categories = {
                'contrast-aa': 'visual',
                'contrast-aaa': 'visual',
                'focus-accessibility': 'keyboard',
                'missing-accessible-name': 'semantic',
                'missing-required-state': 'semantic',
                'touch-target-size': 'motor',
                'readability-issues': 'cognitive'
            };
            return categories[type] || 'other';
        },

        getWCAGCriteria(type) {
            const criteria = {
                'contrast-aa': '1.4.3 Contrast (Minimum)',
                'contrast-aaa': '1.4.6 Contrast (Enhanced)',
                'focus-accessibility': '2.4.7 Focus Visible',
                'missing-accessible-name': '4.1.2 Name, Role, Value',
                'missing-required-state': '4.1.2 Name, Role, Value',
                'touch-target-size': '2.5.5 Target Size',
                'readability-issues': '3.1.5 Reading Level'
            };
            return criteria[type] || 'General';
        },

        canAutomate(type) {
            const automatable = [
                'contrast-aa', 'contrast-aaa', 'missing-accessible-name',
                'touch-target-size', 'focus-accessibility'
            ];
            return automatable.includes(type);
        },

        generateSelector(element) {
            if (element.id) {
                return `#${element.id}`;
            }

            let selector = element.tagName.toLowerCase();

            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\s+/);
                if (classes.length > 0 && classes[0] !== '') {
                    selector += '.' + classes.join('.');
                }
            }

            // Добавляем nth-child если селектор не уникален
            const similarElements = document.querySelectorAll(selector);
            if (similarElements.length > 1) {
                const parent = element.parentElement;
                if (parent) {
                    const siblings = Array.from(parent.children).filter(child =>
                        child.tagName === element.tagName && child.className === element.className
                    );
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(element) + 1;
                        selector += `:nth-child(${index})`;
                    }
                }
            }

            return selector;
        },

        getElementPath(element) {
            const path = [];
            let current = element;

            while (current && current !== document.body && current !== document.documentElement) {
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

        // === СОЗДАНИЕ ИНТЕРФЕЙСА ===
        createAccessibilityInterface() {
            const container = document.createElement('div');
            container.id = 'accessibility-analyzer-results';
            container.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 650px;
        max-height: 80vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #0f3460;
        border-radius: 16px;
        color: #fff;
        font-family: 'SF Mono', Consolas, 'Liberation Mono', monospace;
        font-size: 12px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        backdrop-filter: blur(20px);
      `;

            // Header with WCAG level selector
            const header = this.createHeader();

            // Stats dashboard
            const stats = this.createStatsDashboard();

            // Filter tabs
            const filterTabs = this.createFilterTabs();

            // Issues container
            const issuesContainer = document.createElement('div');
            issuesContainer.id = 'a11y-issues-container';
            issuesContainer.style.cssText = 'padding: 12px; max-height: 450px; overflow-y: auto;';

            // Controls
            const controls = this.createControls();

            // Assembly
            container.appendChild(header);
            container.appendChild(stats);
            container.appendChild(filterTabs);
            container.appendChild(issuesContainer);
            container.appendChild(controls);

            this.setupEventListeners(container);
            this.renderIssues(issuesContainer, 'all');

            document.body.appendChild(container);
            console.log('Accessibility interface added to DOM');
        },

        createHeader() {
            const header = document.createElement('div');
            header.style.cssText = `
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 14px 14px 0 0;
      `;

            header.innerHTML = `
        <div>
          <div style="font-weight: bold; font-size: 16px;">♿ Accessibility Analyzer</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">WCAG 2.1 Compliance Check</div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <select id="wcag-level-selector" style="background:#5a67d8;border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:11px;">
            <option value="AA">WCAG AA</option>
            <option value="AAA">WCAG AAA</option>
          </select>
          <button id="close-a11y-analyzer" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:0.8;">✕</button>
        </div>
      `;

            return header;
        },

        createStatsDashboard() {
            const stats = document.createElement('div');
            stats.style.cssText = 'padding: 16px 20px; background: #2a2a3e; border-bottom: 1px solid #444;';

            const totalIssues = this.state.fixableIssues.length;
            const criticalCount = this.state.fixableIssues.filter(i => i.severity === 'critical').length;
            const warningCount = this.state.fixableIssues.filter(i => i.severity === 'warning').length;
            const infoCount = this.state.fixableIssues.filter(i => i.severity === 'info').length;

            const categoryStats = this.getAccessibilityCategoryStats();

            stats.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 12px;">
          <div style="text-align: center; padding: 8px; background: rgba(255,75,87,0.1); border-radius: 6px; border: 1px solid rgba(255,75,87,0.2);">
<div style="font-size: 20px; font-weight: bold; color: #ff4757;">${criticalCount}</div>
            <div style="font-size: 10px; color: #ff4757;">🚨 Критических</div>
          </div>
          <div style="text-align: center; padding: 8px; background: rgba(255,165,2,0.1); border-radius: 6px; border: 1px solid rgba(255,165,2,0.2);">
            <div style="font-size: 20px; font-weight: bold; color: #ffa502;">${warningCount}</div>
            <div style="font-size: 10px; color: #ffa502;">⚠️ Предупреждений</div>
          </div>
          <div style="text-align: center; padding: 8px; background: rgba(58,123,213,0.1); border-radius: 6px; border: 1px solid rgba(58,123,213,0.2);">
            <div style="font-size: 20px; font-weight: bold; color: #3a7bd5;">${infoCount}</div>
            <div style="font-size: 10px; color: #3a7bd5;">💡 Рекомендаций</div>
          </div>
          <div style="text-align: center; padding: 8px; background: rgba(0,210,255,0.1); border-radius: 6px; border: 1px solid rgba(0,210,255,0.2);">
            <div style="font-size: 20px; font-weight: bold; color: #00d2ff;">${totalIssues}</div>
            <div style="font-size: 10px; color: #00d2ff;">📊 Всего проблем</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; font-size: 11px;">
          <div>👁️ Визуальные: ${categoryStats.visual || 0}</div>
          <div>⌨️ Клавиатура: ${categoryStats.keyboard || 0}</div>
          <div>🏷️ Семантика: ${categoryStats.semantic || 0}</div>
          <div>🤲 Моторика: ${categoryStats.motor || 0}</div>
          <div>🧠 Когнитивные: ${categoryStats.cognitive || 0}</div>
        </div>
      `;

            return stats;
        },

        getAccessibilityCategoryStats() {
            const stats = {
                visual: 0,
                keyboard: 0,
                semantic: 0,
                motor: 0,
                cognitive: 0,
                other: 0
            };

            this.state.fixableIssues.forEach(issue => {
                const category = issue.category || 'other';
                stats[category] = (stats[category] || 0) + 1;
            });

            return stats;
        },

        createFilterTabs() {
            const filterTabs = document.createElement('div');
            filterTabs.style.cssText = `
    display: flex; 
    background: #333; 
    border-bottom: 1px solid #444;
    overflow-x: auto;
    gap: 2px;
  `;

            const filters = [{
                    name: 'all',
                    label: 'Все',
                    icon: '📋',
                    color: '#667eea'
                },
                {
                    name: 'critical',
                    label: 'Критические',
                    icon: '🚨',
                    color: '#ff4757'
                },
                {
                    name: 'visual',
                    label: 'Визуальные',
                    icon: '👁️',
                    color: '#5f27cd'
                },
                {
                    name: 'keyboard',
                    label: 'Клавиатура',
                    icon: '⌨️',
                    color: '#00d2ff'
                },
                {
                    name: 'semantic',
                    label: 'Семантика',
                    icon: '🏷️',
                    color: '#10ac84'
                },
                {
                    name: 'wcag-aa',
                    label: 'WCAG AA',
                    icon: '✓',
                    color: '#ffa502'
                },
                {
                    name: 'wcag-aaa',
                    label: 'WCAG AAA',
                    icon: '✓✓',
                    color: '#ff6348'
                },
                {
                    name: 'export',
                    label: 'Экспорт',
                    icon: '📤',
                    color: '#764ba2'
                } // Новая вкладка
            ];

            filters.forEach((filter, index) => {
                console.log('Creating tab:', filter.name, filter.label);
                const tab = document.createElement('button');
                tab.style.cssText = `
      flex: 1;
      padding: 12px 8px;
      border: none;
      background: transparent;
      color: #ccc;
      cursor: pointer;
      font-size: 11px;
      border-bottom: 3px solid transparent;
      transition: all 0.3s ease;
      white-space: nowrap;
      min-width: 80px;
    `;

                tab.innerHTML = `
      <div>${filter.icon}</div>
      <div style="margin-top: 2px;">${filter.label}</div>
    `;
                tab.dataset.filter = filter.name;
                tab.dataset.color = filter.color;

                if (filter.name === 'all') {
                    tab.style.color = '#fff';
                    tab.style.borderBottomColor = filter.color;
                    tab.style.background = `linear-gradient(180deg, transparent 0%, ${filter.color}15 100%)`;
                }

                tab.addEventListener('click', (event) => {
                    console.log('Tab clicked:', filter.name);
                    if (filter.name === 'export') {
                        console.log('Showing export tab');
                        this.showExportTab();
                    } else {
                        console.log('Filtering issues:', filter.name);
                        this.filterAccessibilityIssues(filter.name, tab);
                    }
                });
                filterTabs.appendChild(tab);
            });

            console.log('All tabs created, total:', filterTabs.children.length);
            return filterTabs;
        },

        // Новый метод для отображения вкладки экспорта
        showExportTab() {
            console.log('showExportTab called');
            
            // Обновляем активную вкладку
            document.querySelectorAll('[data-filter]').forEach(tab => {
                tab.style.color = '#ccc';
                tab.style.borderBottomColor = 'transparent';
                tab.style.background = 'transparent';
            });

            const exportTab = document.querySelector('[data-filter="export"]');
            console.log('Export tab found:', exportTab);
            
            if (exportTab) {
                const color = exportTab.dataset.color;
                exportTab.style.color = '#fff';
                exportTab.style.borderBottomColor = color;
                exportTab.style.background = `linear-gradient(180deg, transparent 0%, ${color}15 100%)`;
            }

            // Отображаем панель экспорта
            const container = document.getElementById('a11y-issues-container');
            console.log('Container found:', container);
            
            if (container) {
                // Увеличиваем высоту контейнера для панели экспорта
                container.style.maxHeight = '85vh';
                container.style.height = 'auto';
                container.style.minHeight = '600px';
                
                // Также увеличиваем высоту основного контейнера
                const mainContainer = document.getElementById('accessibility-analyzer-results');
                if (mainContainer) {
                    mainContainer.style.maxHeight = '95vh';
                    mainContainer.style.minHeight = '700px';
                }
                
                this.renderExportPanel(container);
            } else {
                console.error('Container a11y-issues-container not found');
                // Попробуем найти контейнер по другому селектору
                const altContainer = document.querySelector('#accessibility-analyzer-results .a11y-issues-container') || 
                                   document.querySelector('#accessibility-analyzer-results > div:nth-child(4)');
                console.log('Alternative container found:', altContainer);
                if (altContainer) {
                    altContainer.style.maxHeight = '80vh';
                    altContainer.style.height = 'auto';
                    this.renderExportPanel(altContainer);
                }
            }
        },
        // Создание панели экспорта
        renderExportPanel(container) {
            console.log('renderExportPanel called with container:', container);
            container.innerHTML = '';

            const exportPanel = document.createElement('div');
            exportPanel.style.cssText = `
    padding: 30px;
    background: linear-gradient(135deg, #2a2a3e 0%, #3a3a4e 100%);
    border-radius: 12px;
    margin: 15px;
    min-height: 500px;
  `;

            const stats = this.getExportStats();

            exportPanel.innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h3 style="color: #764ba2; margin: 0 0 8px 0; font-size: 18px;">📤 Экспорт и копирование</h3>
      <p style="color: #ccc; margin: 0; font-size: 12px;">
        Выберите формат экспорта для интеграции с вашим рабочим процессом
      </p>
    </div>

    <!-- Быстрый экспорт -->
    <div style="margin-bottom: 32px;">
      <h4 style="color: #fff; margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center;">
        <span style="margin-right: 10px;">⚡</span>
        Быстрый экспорт
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        ${this.createExportButton('copy-all-quick', '📋 Все проблемы', `${stats.total} проблем`, '#00cc66', 'Полный список всех найденных проблем')}
        ${this.createExportButton('copy-critical-quick', '🚨 Только критические', `${stats.critical} проблем`, '#ff4757', 'Проблемы требующие немедленного исправления')}
        ${this.createExportButton('copy-automated-quick', '🤖 Автоматизируемые', `${stats.automated} проблем`, '#764ba2', 'Проблемы которые можно исправить автоматически')}
      </div>
    </div>

    <!-- Экспорт по категориям -->
    <div style="margin-bottom: 32px;">
      <h4 style="color: #fff; margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center;">
        <span style="margin-right: 10px;">🎯</span>
        По категориям доступности
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
        ${this.createExportButton('copy-visual', '👁️ Визуальные', `${stats.visual} проблем`, '#5f27cd', 'Контраст, цвета, видимость')}
        ${this.createExportButton('copy-keyboard', '⌨️ Клавиатура', `${stats.keyboard} проблем`, '#00d2ff', 'Навигация, фокус, табуляция')}
        ${this.createExportButton('copy-semantic', '🏷️ Семантика', `${stats.semantic} проблем`, '#10ac84', 'ARIA, роли, структура')}
        ${this.createExportButton('copy-motor', '🤲 Моторика', `${stats.motor} проблем`, '#ff6348', 'Размеры касания, таймауты')}
        ${this.createExportButton('copy-cognitive', '🧠 Когнитивные', `${stats.cognitive} проблем`, '#f39c12', 'Читаемость, понятность')}
      </div>
    </div>

    <!-- Специальные отчеты -->
    <div style="margin-bottom: 32px;">
      <h4 style="color: #fff; margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center;">
        <span style="margin-right: 10px;">📊</span>
        Специальные отчеты
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
        ${this.createExportButton('copy-wcag-report', '🏆 WCAG Compliance', 'Полный отчет', '#e67e22', 'Детальный отчет о соответствии WCAG 2.1')}
        ${this.createExportButton('copy-developer-guide', '👨‍💻 Гид разработчика', 'С примерами кода', '#9b59b6', 'Руководство по исправлению с кодом')}
        ${this.createExportButton('copy-testing-plan', '🧪 План тестирования', 'Чек-лист', '#3498db', 'Пошаговый план тестирования доступности')}
        ${this.createExportButton('copy-executive-summary', '📈 Executive Summary', 'Для менеджеров', '#e74c3c', 'Краткий отчет для руководства')}
      </div>
    </div>

    <!-- Форматы экспорта -->
    <div style="margin-bottom: 32px;">
      <h4 style="color: #fff; margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center;">
        <span style="margin-right: 10px;">🔧</span>
        Готовые решения
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        ${this.createExportButton('copy-css-fixes', '🎨 CSS исправления', 'Готовый код', '#2ecc71', 'CSS правила для исправления проблем')}
        ${this.createExportButton('copy-html-improvements', '📝 HTML улучшения', 'Разметка', '#f39c12', 'Примеры правильной HTML разметки')}
        ${this.createExportButton('copy-js-enhancements', '⚡ JS улучшения', 'Скрипты', '#9b59b6', 'JavaScript для динамических улучшений')}
        ${this.createExportButton('copy-json-data', '📄 JSON данные', 'Структурированные данные', '#34495e', 'Данные для интеграции с инструментами')}
      </div>
    </div>

    <!-- Статистика -->
    <div style="background: rgba(255,255,255,0.05); padding: 24px; border-radius: 10px; border-left: 4px solid #764ba2;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 20px; font-size: 13px;">
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #ff4757;">${stats.critical}</div>
          <div style="color: #ccc;">Критических</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #ffa502;">${stats.warning}</div>
          <div style="color: #ccc;">Предупреждений</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #3742fa;">${stats.info}</div>
          <div style="color: #ccc;">Рекомендаций</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #764ba2;">${stats.automated}</div>
          <div style="color: #ccc;">Автоматизируемых</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #00d2ff;">${this.calculateWCAGScore()}%</div>
          <div style="color: #ccc;">WCAG Score</div>
        </div>
      </div>
    </div>
  `;

            // Добавляем обработчики событий
            this.setupExportEventListeners(exportPanel);

            container.appendChild(exportPanel);
            console.log('Export panel added to container');
            
            // Принудительно обновляем отображение
            container.style.display = 'block';
            exportPanel.style.display = 'block';
            
            // Прокручиваем к началу контейнера
            container.scrollTop = 0;
        },
        // Создание кнопки экспорта
        createExportButton(id, title, subtitle, color, description) {
            return `
    <button id="${id}" 
            data-description="${description}"
            style="
              background: linear-gradient(135deg, ${color}20 0%, ${color}10 100%);
              border: 2px solid ${color}40;
              color: #fff;
              padding: 20px;
              border-radius: 10px;
              cursor: pointer;
              font-family: inherit;
              font-size: 12px;
              transition: all 0.3s ease;
              text-align: left;
              position: relative;
              overflow: hidden;
              min-height: 80px;
              display: flex;
              flex-direction: column;
              justify-content: center;
            ">
      <div style="font-weight: bold; margin-bottom: 6px; color: ${color}; font-size: 13px;">${title}</div>
      <div style="color: #ccc; font-size: 11px;">${subtitle}</div>
      <div style="position: absolute; top: 12px; right: 12px; font-size: 18px; opacity: 0.7;">📤</div>
    </button>
  `;
        },
        // Получение статистики для экспорта
        getExportStats() {
            const issues = this.state.fixableIssues;

            return {
                total: issues.length,
                critical: issues.filter(i => i.severity === 'critical').length,
                warning: issues.filter(i => i.severity === 'warning').length,
                info: issues.filter(i => i.severity === 'info').length,
                automated: issues.filter(i => i.automationPossible).length,
                visual: issues.filter(i => i.category === 'visual').length,
                keyboard: issues.filter(i => i.category === 'keyboard').length,
                semantic: issues.filter(i => i.category === 'semantic').length,
                motor: issues.filter(i => i.category === 'motor').length,
                cognitive: issues.filter(i => i.category === 'cognitive').length
            };
        },
        // Настройка обработчиков событий для экспорта
        setupExportEventListeners(panel) {
            // Hover effects для кнопок
            const buttons = panel.querySelectorAll('button[id^="copy-"]');
            buttons.forEach(button => {
                button.addEventListener('mouseenter', (e) => {
                    const description = e.target.dataset.description;
                    this.showExportTooltip(e.target, description);

                    // Анимация кнопки
                    e.target.style.transform = 'translateY(-2px) scale(1.02)';
                    e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
                });

                button.addEventListener('mouseleave', (e) => {
                    this.hideExportTooltip();
                    e.target.style.transform = 'translateY(0) scale(1)';
                    e.target.style.boxShadow = 'none';
                });
            });

            // Обработчики кликов
            const clickHandlers = {
                'copy-all-quick': () => this.copyAccessibilityFixes('all'),
                'copy-critical-quick': () => this.copyAccessibilityFixes('critical'),
                'copy-automated-quick': () => this.copyAccessibilityFixes('automated'),
                'copy-visual': () => this.copyByCategory('visual'),
                'copy-keyboard': () => this.copyByCategory('keyboard'),
                'copy-semantic': () => this.copyByCategory('semantic'),
                'copy-motor': () => this.copyByCategory('motor'),
                'copy-cognitive': () => this.copyByCategory('cognitive'),
                'copy-wcag-report': () => this.copyWCAGReport(),
                'copy-developer-guide': () => this.copyDeveloperGuide(),
                'copy-testing-plan': () => this.copyTestingPlan(),
                'copy-executive-summary': () => this.copyExecutiveSummary(),
                'copy-css-fixes': () => this.copyCSSFixes(),
                'copy-html-improvements': () => this.copyHTMLImprovements(),
                'copy-js-enhancements': () => this.copyJSEnhancements(),
                'copy-json-data': () => this.copyJSONData()
            };

            Object.entries(clickHandlers).forEach(([id, handler]) => {
                const button = panel.querySelector(`#${id}`);
                if (button) {
                    button.addEventListener('click', (e) => {
                        // Анимация клика
                        e.target.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            e.target.style.transform = 'translateY(-2px) scale(1.02)';
                        }, 150);

                        handler();
                    });
                }
            });
        },
        // Показать подсказку для экспорта
        showExportTooltip(element, description) {
            const tooltip = document.createElement('div');
            tooltip.id = 'export-tooltip';
            tooltip.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.95);
    color: white;
    padding: 8px 12px;
    font-size: 11px;
    border-radius: 6px;
    white-space: nowrap;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.3s ease;
    max-width: 250px;
    white-space: normal;
    text-align: center;
    margin-bottom: 8px;
    border: 1px solid #764ba2;
  `;

            tooltip.textContent = description;
            element.style.position = 'relative';
            element.appendChild(tooltip);

            setTimeout(() => {
                tooltip.style.opacity = '1';
            }, 100);
        },

        // Скрыть подсказку экспорта
        hideExportTooltip() {
            const tooltip = document.getElementById('export-tooltip');
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                }, 300);
            }
        },

        // Новые методы копирования по категориям
        async copyByCategory(category) {
            const filteredIssues = this.state.fixableIssues.filter(issue => issue.category === category);

            if (filteredIssues.length === 0) {
                this.showAccessibilityNotification(`❌ Нет проблем категории "${category}"`, 'warning');
                return;
            }

            const categoryData = {
                title: `♿ Accessibility Issues - ${category.toUpperCase()} Category`,
                category: category,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                issues: filteredIssues,
                summary: {
                    total: filteredIssues.length,
                    critical: filteredIssues.filter(i => i.severity === 'critical').length,
                    estimatedTime: this.calculateTotalFixTime(filteredIssues) + ' минут'
                }
            };

            try {
                await navigator.clipboard.writeText(JSON.stringify(categoryData, null, 2));
                this.showAccessibilityNotification(`✅ Проблемы категории "${category}" скопированы!`, 'success');
            } catch (err) {
                console.log(`${category.toUpperCase()} Category Issues:`, categoryData);
                this.showAccessibilityNotification(`📋 Данные выведены в консоль`, 'info');
            }
        },

        // Копирование руководства разработчика
        async copyDeveloperGuide() {
            const guide = {
                title: '👨‍💻 Developer Accessibility Guide',
                timestamp: new Date().toISOString(),
                url: window.location.href,

                quickStart: {
                    description: 'Первые шаги для исправления доступности',
                    steps: [
                        '1. Исправьте все критические проблемы',
                        '2. Добавьте отсутствующие aria-label',
                        '3. Проверьте контрастность цветов',
                        '4. Убедитесь в корректной фокусировке',
                        '5. Протестируйте с клавиатурой'
                    ]
                },

                codeExamples: this.generateAllCodeExamples(),
                testingChecklist: this.generateTestingChecklist(),
                resources: this.generateDeveloperResources(),
                issuesByPriority: this.state.fixableIssues
                    .sort((a, b) => this.getAccessibilityPriority(a) - this.getAccessibilityPriority(b))
                    .slice(0, 10)
            };

            try {
                await navigator.clipboard.writeText(JSON.stringify(guide, null, 2));
                this.showAccessibilityNotification('✅ Руководство разработчика скопировано!', 'success');
                console.log('👨‍💻 Developer Guide:', guide);
            } catch (err) {
                console.log('👨‍💻 Developer Guide:', guide);
                this.showAccessibilityNotification('📋 Руководство выведено в консоль', 'info');
            }
        },

        // Копирование плана тестирования
        async copyTestingPlan() {
            const plan = {
                title: '🧪 Accessibility Testing Plan',
                timestamp: new Date().toISOString(),

                automatedTesting: {
                    tools: ['axe-core', 'Pa11y', 'Lighthouse', 'WAVE'],
                    schedule: 'На каждый коммит и деплой',
                    coverage: 'Базовая проверка ~40% критериев WCAG'
                },

                manualTesting: {
                    keyboardNavigation: [
                        'Tab через все интерактивные элементы',
                        'Проверка видимости фокуса',
                        'Escape для закрытия модальных окон',
                        'Enter/Space для активации кнопок'
                    ],
                    screenReaderTesting: [
                        'NVDA (Windows) - бесплатный',
                        'VoiceOver (macOS) - встроенный',
                        'Проверка объявления всех элементов',
                        'Навигация по заголовкам (H1-H6)'
                    ],
                    visualTesting: [
                        'Увеличение до 200%',
                        'Проверка в высококонтрастном режиме',
                        'Тестирование без цветов',
                        'Мобильная доступность'
                    ]
                },

                userTesting: {
                    targetGroups: ['Пользователи скрин-ридеров', 'Пользователи только клавиатуры', 'Люди с нарушениями зрения'],
                    scenarios: this.generateUserTestingScenarios(),
                    frequency: 'Раз в квартал для критических путей'
                },

                currentIssues: this.state.fixableIssues.map(issue => ({
                    type: issue.issueType,
                    priority: issue.severity,
                    testMethod: this.getTestMethodForIssue(issue.issueType),
                    automation: issue.automationPossible
                }))
            };

            try {
                await navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
                this.showAccessibilityNotification('✅ План тестирования скопирован!', 'success');
            } catch (err) {
                console.log('🧪 Testing Plan:', plan);
                this.showAccessibilityNotification('📋 План выведен в консоль', 'info');
            }
        },

        // Дополнительные методы...
        generateAllCodeExamples() {
            const examples = {};
            const issueTypes = [...new Set(this.state.fixableIssues.map(i => i.issueType))];

            issueTypes.forEach(type => {
                const issue = this.state.fixableIssues.find(i => i.issueType === type);
                if (issue && issue.fixes.length > 0) {
                    examples[type] = this.generateCodeExample(issue.fixes[0], type);
                }
            });

            return examples;
        },

        generateTestingChecklist() {
            return [
                '☐ Все изображения имеют alt атрибуты',
                '☐ Интерактивные элементы фокусируемы',
                '☐ Контрастность текста соответствует WCAG AA',
                '☐ Заголовки следуют логической иерархии',
                '☐ Формы имеют подписи для всех полей',
                '☐ Ошибки объявляются скрин-ридерами',
                '☐ Сайт работает без JavaScript',
                '☐ Увеличение до 200% не ломает лейаут'
            ];
        },

        generateDeveloperResources() {
            return {
                documentation: [
                    'MDN Web Accessibility: https://developer.mozilla.org/en-US/docs/Web/Accessibility',
                    'WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/',
                    'ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/'
                ],
                tools: [
                    'axe DevTools browser extension',
                    'Colour Contrast Analyser',
                    'HeadingsMap browser extension',
                    'Web Developer browser extension'
                ],
                testing: [
                    'NVDA Screen Reader (free)',
                    'Pa11y command line tool',
                    'jest-axe for automated testing'
                ]
            };
        },
        createControls() {
            const controls = document.createElement('div');
            controls.style.cssText = 'padding: 16px 20px; background: #333; border-radius: 0 0 14px 14px;';

            const automationStats = this.getAutomationStats();

            controls.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px;">
          <button id="clear-a11y-highlights" style="background:#555;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
            🧹 Очистить подсветку
          </button>
          <button id="export-a11y-report" style="background:#667eea;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
            📊 Полный отчет
          </button>
          <button id="run-contrast-check" style="background:#5f27cd;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
            🎨 Перепроверить контраст
          </button>
          <button id="simulate-screen-reader" style="background:#10ac84;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:11px;">
            🔊 Симуляция скрин-ридера
          </button>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-bottom: 8px;">
          <button id="copy-all-a11y-fixes" style="background:#00cc66;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            📋 Все исправления (${this.state.fixableIssues.length})
          </button>
          <button id="copy-critical-a11y-fixes" style="background:#ff4444;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            🚨 Критические (${automationStats.critical})
          </button>
          <button id="copy-automated-fixes" style="background:#764ba2;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            🤖 Автоматизируемые (${automationStats.automated})
          </button>
          <button id="copy-wcag-report" style="background:#ffa502;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:10px;">
            ✓ WCAG отчет
          </button>
        </div>
        
        <div style="font-size: 10px; color: #888; text-align: center;">
          💡 Кликните на проблему для подсветки • Hover для деталей WCAG
        </div>
      `;

            return controls;
        },

        getAutomationStats() {
            return {
                critical: this.state.fixableIssues.filter(i => i.severity === 'critical').length,
                automated: this.state.fixableIssues.filter(i => i.automationPossible).length
            };
        },

        renderIssues(container, filterType) {
            container.innerHTML = '';

            let filteredIssues = this.state.fixableIssues;

            switch (filterType) {
                case 'critical':
                    filteredIssues = this.state.fixableIssues.filter(i => i.severity === 'critical');
                    break;
                case 'visual':
                    filteredIssues = this.state.fixableIssues.filter(i => i.category === 'visual');
                    break;
                case 'keyboard':
                    filteredIssues = this.state.fixableIssues.filter(i => i.category === 'keyboard');
                    break;
                case 'semantic':
                    filteredIssues = this.state.fixableIssues.filter(i => i.category === 'semantic');
                    break;
                case 'wcag-aa':
                    filteredIssues = this.state.fixableIssues.filter(i => i.wcagLevel === 'AA' || i.wcagLevel === 'A');
                    break;
                case 'wcag-aaa':
                    filteredIssues = this.state.fixableIssues.filter(i => i.wcagLevel === 'AAA');
                    break;
            }

            if (filteredIssues.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.style.cssText = `
          padding: 50px 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        `;

                const icons = {
                    'all': '🎉',
                    'critical': '✅',
                    'visual': '👁️✨',
                    'keyboard': '⌨️✅',
                    'semantic': '🏷️✓',
                    'wcag-aa': '🏆',
                    'wcag-aaa': '🥇'
                };

                emptyState.innerHTML = `
          <div style="font-size: 64px; margin-bottom: 16px;">${icons[filterType] || '🎉'}</div>
          <div style="font-weight: bold; margin-bottom: 8px;">Отличная работа!</div>
          <div style="font-size: 12px;">
            Проблем категории "${filterType}" не обнаружено
          </div>
        `;
                container.appendChild(emptyState);
                return;
            }

            // Сортируем по приоритету
            filteredIssues.sort((a, b) => {
                const severityOrder = {
                    critical: 0,
                    warning: 1,
                    info: 2
                };
                return severityOrder[a.severity] - severityOrder[b.severity];
            });

            filteredIssues.forEach((issue, index) => {
                const issueElement = this.createIssueElement(issue, index);
                container.appendChild(issueElement);
            });
        },

        createIssueElement(issue, index) {
            const row = document.createElement('div');
            row.style.cssText = `
        padding: 16px;
        margin: 8px 0;
        border-left: 4px solid ${this.getSeverityColor(issue.severity)};
        background: linear-gradient(135deg, #2a2a3e 0%, #3a3a4e 100%);
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      `;

            // WCAG level indicator
            const wcagBadge = this.createWCAGBadge(issue);
            const categoryBadge = this.createCategoryBadge(issue);
            const severityBadge = this.createSeverityBadge(issue);

            row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">
              ${this.getIssueTitle(issue)}
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
              ${wcagBadge}
              ${categoryBadge}
              ${severityBadge}
              ${issue.automationPossible ? '<span style="background:#10ac84;color:#fff;padding:2px 6px;border-radius:12px;font-size:9px;">🤖 AUTO</span>' : ''}
            </div>
          </div>
          <div style="text-align: right; color: #888; font-size: 11px;">
            <div>${issue.affectedElements} элементов</div>
            <div>${this.getEstimatedFixTime(issue.issueType)}</div>
          </div>
        </div>
        
        <div style="color: #ccc; font-size: 12px; line-height: 1.4; margin-bottom: 10px;">
          ${issue.description}
        </div>
        
        ${this.createImpactInfo(issue)}
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="color: #888; font-size: 10px;">
            💡 Клик для подсветки • ${issue.wcagCriteria}
          </div>
          <div style="font-size: 10px; color: #${this.getSeverityColor(issue.severity).slice(1)};">
            ${issue.impact}
          </div>
        </div>
      `;

            // Enhanced interactions with accessibility info
            row.addEventListener('click', () => {
                const elements = issue.fixes.map(fix => {
                    const element = document.querySelector(fix.selector);
                    return element;
                }).filter(Boolean);

                this.highlightAccessibilityElements(elements, issue);
            });

            row.addEventListener('mouseenter', () => {
                row.style.background = 'linear-gradient(135deg, #3a3a4e 0%, #4a4a5e 100%)';
                row.style.transform = 'translateY(-2px) scale(1.02)';
                row.style.boxShadow = `0 8px 25px ${this.getSeverityColor(issue.severity)}40`;
                this.showWCAGTooltip(row, issue);
            });

            row.addEventListener('mouseleave', () => {
                row.style.background = 'linear-gradient(135deg, #2a2a3e 0%, #3a3a4e 100%)';
                row.style.transform = 'translateY(0) scale(1)';
                row.style.boxShadow = 'none';
                this.hideWCAGTooltip();
            });

            return row;
        },

        createWCAGBadge(issue) {
            const colors = {
                'A': '#10ac84',
                'AA': '#ffa502',
                'AAA': '#ff4757'
            };

            return `<span style="background:${colors[issue.wcagLevel] || colors.AA};color:#fff;padding:2px 6px;border-radius:12px;font-size:9px;font-weight:bold;">WCAG ${issue.wcagLevel}</span>`;
        },

        createCategoryBadge(issue) {
            const categories = {
                'visual': {
                    icon: '👁️',
                    color: '#5f27cd',
                    label: 'Visual'
                },
                'keyboard': {
                    icon: '⌨️',
                    color: '#00d2ff',
                    label: 'Keyboard'
                },
                'semantic': {
                    icon: '🏷️',
                    color: '#10ac84',
                    label: 'Semantic'
                },
                'motor': {
                    icon: '🤲',
                    color: '#ff6348',
                    label: 'Motor'
                },
                'cognitive': {
                    icon: '🧠',
                    color: '#764ba2',
                    label: 'Cognitive'
                }
            };

            const cat = categories[issue.category] || {
                icon: '❓',
                color: '#666',
                label: 'Other'
            };

            return `<span style="background:${cat.color};color:#fff;padding:2px 6px;border-radius:12px;font-size:9px;">${cat.icon} ${cat.label}</span>`;
        },

        createSeverityBadge(issue) {
            const severities = {
                'critical': {
                    label: 'КРИТИЧНО',
                    color: '#ff4757'
                },
                'warning': {
                    label: 'ВНИМАНИЕ',
                    color: '#ffa502'
                },
                'info': {
                    label: 'ИНФО',
                    color: '#3742fa'
                }
            };

            const sev = severities[issue.severity];
            return `<span style="background:${sev.color};color:#fff;padding:2px 6px;border-radius:12px;font-size:9px;font-weight:bold;">${sev.label}</span>`;
        },

        getIssueTitle(issue) {
            const titles = {
                'contrast-aa': '🎨 Недостаточный контраст (WCAG AA)',
                'contrast-aaa': '🎨 Контраст ниже AAA стандарта',
                'focus-accessibility': '🎯 Проблемы с фокусировкой',
                'missing-accessible-name': '🏷️ Отсутствует доступное имя',
                'missing-required-state': '🔄 Отсутствует обязательное состояние',
                'touch-target-size': '👆 Маленький размер касания',
                'readability-issues': '📖 Проблемы читаемости',
                'invalid-role': '❌ Недопустимая ARIA роль',
                'aria-conflict': '⚠️ Конфликт ARIA атрибутов'
            };

            return titles[issue.issueType] || `❓ ${issue.issueType}`;
        },

        createImpactInfo(issue) {
            return `
        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin: 8px 0;">
          <div style="font-size: 11px; color: #ddd; display: flex; justify-content: space-between;">
            <div>
              <strong>Воздействие:</strong> ${issue.impact}
            </div>
            <div>
              <strong>WCAG:</strong> ${issue.wcagCriteria}
            </div>
          </div>
        </div>
      `;
        },

        showWCAGTooltip(element, issue) {
            const tooltip = document.createElement('div');
            tooltip.id = 'wcag-tooltip';
            tooltip.style.cssText = `
        position: absolute;
        top: -120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 12px 16px;
        font-size: 11px;
        border-radius: 8px;
        white-space: nowrap;
        z-index: 10001;
        opacity: 0;
        transition: opacity 0.3s ease;
        border: 1px solid ${this.getSeverityColor(issue.severity)};
        max-width: 300px;
        white-space: normal;
        line-height: 1.4;
      `;

            tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 6px;">${issue.wcagCriteria}</div>
        <div style="margin-bottom: 4px;">${issue.impact}</div>
        <div style="color: #ccc; font-size: 10px;">
          Затронуто элементов: ${issue.affectedElements} • 
          ${issue.automationPossible ? 'Автоматизируемо' : 'Ручная проверка'}
        </div>
      `;

            element.appendChild(tooltip);

            setTimeout(() => {
                tooltip.style.opacity = '1';
            }, 10);
        },

        hideWCAGTooltip() {
            const tooltip = document.getElementById('wcag-tooltip');
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                }, 300);
            }
        },

        highlightAccessibilityElements(elements, issue) {
            this.clearHighlights();

            if (elements.length === 0) {
                this.showAccessibilityNotification('🔍 Элементы не найдены или скрыты', 'warning');
                return;
            }

            elements.forEach((element, index) => {
                if (!element) return;

                const overlay = document.createElement('div');
                overlay.className = 'a11y-highlight';

                const color = this.getSeverityColor(issue.severity);

                overlay.style.cssText = `
          position: absolute;
          pointer-events: none;
          background: ${color}25;
          border: 3px solid ${color};
          border-radius: 8px;
          z-index: 9999;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          animation: a11yPulse 3s infinite;
          box-shadow: 0 0 20px ${color}40;
        `;

                const rect = element.getBoundingClientRect();
                overlay.style.top = (rect.top + window.scrollY - 4) + 'px';
                overlay.style.left = (rect.left + window.scrollX - 4) + 'px';
                overlay.style.width = (rect.width + 8) + 'px';
                overlay.style.height = (rect.height + 8) + 'px';

                // Enhanced label with issue info
                const label = document.createElement('div');
                label.style.cssText = `
          position: absolute;
          top: -40px;
          left: -4px;
          background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
          color: white;
          padding: 6px 10px;
          font-size: 11px;
          border-radius: 8px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          max-width: 200px;
          white-space: normal;
          line-height: 1.3;
        `;

                const tagName = element.tagName.toLowerCase();
                const issueTypeShort = issue.issueType.split('-')[0];
                label.innerHTML = `
          <div>${index + 1}. ${tagName} - ${issueTypeShort}</div>
          <div style="font-size: 9px; opacity: 0.9; margin-top: 2px;">WCAG ${issue.wcagLevel} • ${issue.category}</div>
        `;
                overlay.appendChild(label);

                // Add detailed info panel
                const infoPanel = document.createElement('div');
                infoPanel.style.cssText = `
          position: absolute;
          top: -100px;
          right: -4px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          font-size: 10px;
          border-radius: 6px;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          max-width: 250px;
          border: 1px solid ${color};
        `;

                // Show issue-specific info
                let infoContent = '';
                if (issue.issueType.includes('contrast')) {
                    const fix = issue.fixes.find(f => f.selector === this.generateSelector(element));
                    if (fix) {
                        infoContent = `
              <div><strong>Текущий контраст:</strong> ${fix.currentValues['current-ratio']}:1</div>
              <div><strong>Требуется:</strong> ${fix.currentValues['required-ratio']}:1</div>
            `;
                    }
                } else if (issue.issueType.includes('touch-target')) {
                    const fix = issue.fixes.find(f => f.selector === this.generateSelector(element));
                    if (fix) {
                        infoContent = `
              <div><strong>Размер:</strong> ${fix.currentValues.width} × ${fix.currentValues.height}</div>
              <div><strong>Минимум:</strong> 44×44px</div>
            `;
                    }
                } else {
                    infoContent = `<div>${issue.description}</div>`;
                }

                infoPanel.innerHTML = infoContent;
                overlay.appendChild(infoPanel);

                // Show info panel on hover
                overlay.addEventListener('mouseenter', () => {
                    infoPanel.style.opacity = '1';
                });

                overlay.addEventListener('mouseleave', () => {
                    infoPanel.style.opacity = '0';
                });

                document.body.appendChild(overlay);
                this.state.highlightedElements.add(overlay);

                // Staggered animation
                setTimeout(() => {
                    overlay.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        overlay.style.transform = 'scale(1)';
                    }, 300);
                }, index * 150);
            });

            // Add pulse animation styles if not present
            if (!document.getElementById('a11y-pulse-styles')) {
                const style = document.createElement('style');
                style.id = 'a11y-pulse-styles';
                style.textContent = `
          @keyframes a11yPulse {
            0% { box-shadow: 0 0 20px ${this.getSeverityColor(issue.severity)}40; }
            50% { box-shadow: 0 0 30px ${this.getSeverityColor(issue.severity)}60; }
            100% { box-shadow: 0 0 20px ${this.getSeverityColor(issue.severity)}40; }
          }
        `;
                document.head.appendChild(style);
            }

            // Scroll to first element
            if (elements.length > 0 && elements[0]) {
                elements[0].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                });
            }

            this.showAccessibilityNotification(`🎯 Подсвечено ${elements.length} элементов с проблемой "${issue.issueType}"`, 'info');
        },

        // === EVENT HANDLERS ===
        setupEventListeners(container) {
            // Close button
            container.querySelector('#close-a11y-analyzer').addEventListener('click', () => {
                this.cleanup();
            });

            // WCAG level selector
            container.querySelector('#wcag-level-selector').addEventListener('change', (e) => {
                this.state.wcagLevel = e.target.value;
                this.showAccessibilityNotification(`Переключен на WCAG ${e.target.value} уровень`, 'info');
                // Re-run analysis with new level
                this.reanalyzeWithLevel(e.target.value);
            });

            // Clear highlights
            container.querySelector('#clear-a11y-highlights').addEventListener('click', () => {
                this.clearHighlights();
            });

            // Export report
            container.querySelector('#export-a11y-report').addEventListener('click', () => {
                this.exportAccessibilityReport();
            });

            // Re-run contrast check
            container.querySelector('#run-contrast-check').addEventListener('click', () => {
                this.rerunContrastCheck();
            });

            // Screen reader simulation
            container.querySelector('#simulate-screen-reader').addEventListener('click', () => {
                this.simulateScreenReader();
            });

            // Copy buttons
            container.querySelector('#copy-all-a11y-fixes').addEventListener('click', () => {
                this.copyAccessibilityFixes('all');
            });

            container.querySelector('#copy-critical-a11y-fixes').addEventListener('click', () => {
                this.copyAccessibilityFixes('critical');
            });

            container.querySelector('#copy-automated-fixes').addEventListener('click', () => {
                this.copyAccessibilityFixes('automated');
            });

            container.querySelector('#copy-wcag-report').addEventListener('click', () => {
                this.copyWCAGReport();
            });
        },

        filterAccessibilityIssues(filterType, activeTab) {
            // Update active tab
            document.querySelectorAll('[data-filter]').forEach(tab => {
                tab.style.color = '#ccc';
                tab.style.borderBottomColor = 'transparent';
                tab.style.background = 'transparent';
            });

            const color = activeTab.dataset.color;
            activeTab.style.color = '#fff';
            activeTab.style.borderBottomColor = color;
            activeTab.style.background = `linear-gradient(180deg, transparent 0%, ${color}15 100%)`;

            // Re-render issues
            const container = document.getElementById('a11y-issues-container');
            
            // Восстанавливаем стандартную высоту контейнера для обычных вкладок
            if (filterType !== 'export') {
                container.style.maxHeight = '450px';
                container.style.height = 'auto';
            }
            
            this.renderIssues(container, filterType);
        },

        // === ADVANCED FEATURES ===
        async copyAccessibilityFixes(filterType) {
            let filteredIssues;
            let title;

            switch (filterType) {
                case 'critical':
                    filteredIssues = this.state.fixableIssues.filter(issue => issue.severity === 'critical');
                    title = 'КРИТИЧЕСКИЕ ПРОБЛЕМЫ ДОСТУПНОСТИ';
                    break;
                case 'automated':
                    filteredIssues = this.state.fixableIssues.filter(issue => issue.automationPossible);
                    title = 'АВТОМАТИЗИРУЕМЫЕ ИСПРАВЛЕНИЯ ДОСТУПНОСТИ';
                    break;
                default:
                    filteredIssues = this.state.fixableIssues;
                    title = 'ВСЕ ПРОБЛЕМЫ ДОСТУПНОСТИ';
            }

            if (filteredIssues.length === 0) {
                this.showAccessibilityNotification(`❌ Нет проблем типа "${filterType}" для копирования`, 'warning');
                return;
            }

            const accessibilityReport = {
                title: `♿ Accessibility Analyzer - ${title}`,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                wcagLevel: this.state.wcagLevel,
                filterType: filterType,

                executiveSummary: {
                    totalIssues: filteredIssues.length,
                    criticalCount: filteredIssues.filter(i => i.severity === 'critical').length,
                    warningCount: filteredIssues.filter(i => i.severity === 'warning').length,
                    infoCount: filteredIssues.filter(i => i.severity === 'info').length,
                    automationPossible: filteredIssues.filter(i => i.automationPossible).length,
                    estimatedTotalTime: this.calculateTotalFixTime(filteredIssues),
                    affectedElements: filteredIssues.reduce((sum, issue) => sum + issue.affectedElements, 0)
                },

                wcagCompliance: {
                    level: this.state.wcagLevel,
                    criteriaBreached: [...new Set(filteredIssues.map(i => i.wcagCriteria))],
                    categoryBreakdown: this.getCategoryBreakdown(filteredIssues),
                    impactAssessment: this.getImpactAssessment(filteredIssues)
                },

                priorityRoadmap: this.generatePriorityRoadmap(filteredIssues),

                detailedFindings: filteredIssues
                    .sort((a, b) => this.getAccessibilityPriority(a) - this.getAccessibilityPriority(b))
                    .map((issue, index) => ({
                        id: index + 1,
                        severity: issue.severity,
                        category: issue.category,
                        wcagLevel: issue.wcagLevel,
                        wcagCriteria: issue.wcagCriteria,
                        issueType: issue.issueType,
                        description: issue.description,
                        impact: issue.impact,
                        affectedElements: issue.affectedElements,
                        automationPossible: issue.automationPossible,
                        estimatedFixTime: this.getEstimatedFixTime(issue.issueType),
                        fixes: issue.fixes.map((fix, fixIndex) => ({
                            id: `${index + 1}.${fixIndex + 1}`,
                            selector: fix.selector,
                            element: `${fix.tagName}${fix.className ? '.' + fix.className.split(' ').join('.') : ''}${fix.id ? '#' + fix.id : ''}`,
                            path: fix.elementPath,
                            currentState: fix.currentValues,
                            recommendedFix: fix.suggestedFix,
                            codeExample: this.generateCodeExample(fix, issue.issueType),
                            testingInstructions: this.generateTestingInstructions(issue.issueType)
                        }))
                    }))
            };

            // Add implementation guides
            accessibilityReport.implementationGuide = {
                quickWins: this.generateQuickWins(filteredIssues),
                automatedSolutions: this.generateAutomatedSolutions(filteredIssues),
                testingStrategy: this.generateTestingStrategy(filteredIssues),
                resources: this.generateAccessibilityResources()
            };

            try {
                await navigator.clipboard.writeText(JSON.stringify(accessibilityReport, null, 2));

                const typeLabels = {
                    'all': 'полного отчета по доступности',
                    'critical': 'критических проблем доступности',
                    'automated': 'автоматизируемых исправлений'
                };

                this.showAccessibilityNotification(`✅ ${typeLabels[filterType]} скопировано!`, 'success');

                // Enhanced console output
                console.group(`♿ Accessibility Report - ${title}`);
                console.log('📊 Executive Summary:', accessibilityReport.executiveSummary);
                console.log('🎯 WCAG Compliance:', accessibilityReport.wcagCompliance);
                console.log('📋 Priority Roadmap:', accessibilityReport.priorityRoadmap);
                console.log('📖 Implementation Guide:', accessibilityReport.implementationGuide);
                console.log('🔧 Full Report:', accessibilityReport);
                console.groupEnd();

            } catch (err) {
                console.error('Clipboard error:', err);
                this.showAccessibilityNotification(`📋 Отчет выведен в консоль`, 'info');
                console.log(`Accessibility Report - ${title}:`, accessibilityReport);
            }
        },

        async copyWCAGReport() {
            const wcagReport = {
                title: '🏆 WCAG 2.1 Compliance Report',
                timestamp: new Date().toISOString(),
                url: window.location.href,
                testedLevel: this.state.wcagLevel,

                complianceSummary: {
                    overallScore: this.calculateWCAGScore(),
                    levelACompliance: this.checkLevelCompliance('A'),
                    levelAACompliance: this.checkLevelCompliance('AA'),
                    levelAAACompliance: this.checkLevelCompliance('AAA')
                },

                principleBreakdown: {
                    perceivable: this.getPrincipleIssues('perceivable'),
                    operable: this.getPrincipleIssues('operable'),
                    understandable: this.getPrincipleIssues('understandable'),
                    robust: this.getPrincipleIssues('robust')
                },

                criteriaStatus: this.generateCriteriaStatus(),
                recommendations: this.generateWCAGRecommendations(),
                auditTrail: {
                    analyzer: 'Accessibility Analyzer v1.0',
                    testingDate: new Date().toISOString(),
                    testingScope: 'Automated scan + Manual review required',
                    limitations: 'This automated scan covers approximately 30-40% of WCAG criteria. Manual testing required for complete compliance.'
                }
            };

            try {
                await navigator.clipboard.writeText(JSON.stringify(wcagReport, null, 2));
                this.showAccessibilityNotification('✅ WCAG отчет скопирован в буфер обмена!', 'success');
                console.log('🏆 WCAG Compliance Report:', wcagReport);
            } catch (err) {
                console.log('🏆 WCAG Compliance Report:', wcagReport);
                this.showAccessibilityNotification('📋 WCAG отчет выведен в консоль', 'info');
            }
        },

        // === CALCULATION METHODS ===
        calculateTotalFixTime(issues) {
            const timeMap = {
                'contrast-aa': 10,
                'contrast-aaa': 10,
                'focus-accessibility': 15,
                'missing-accessible-name': 8,
                'missing-required-state': 5,
                'touch-target-size': 12,
                'readability-issues': 20
            };

            return issues.reduce((total, issue) => {
                const timePerElement = timeMap[issue.issueType] || 10;
                return total + (timePerElement * issue.affectedElements);
            }, 0);
        },

        getAccessibilityPriority(issue) {
            const severityWeight = {
                critical: 1,
                warning: 2,
                info: 3
            };
            const categoryWeight = {
                semantic: 0.1,
                keyboard: 0.2,
                visual: 0.3,
                motor: 0.4,
                cognitive: 0.5
            };

            return severityWeight[issue.severity] + (categoryWeight[issue.category] || 0.5);
        },

        getCategoryBreakdown(issues) {
            const breakdown = {};
            issues.forEach(issue => {
                if (!breakdown[issue.category]) {
                    breakdown[issue.category] = {
                        count: 0,
                        severity: {
                            critical: 0,
                            warning: 0,
                            info: 0
                        }
                    };
                }
                breakdown[issue.category].count++;
                breakdown[issue.category].severity[issue.severity]++;
            });
            return breakdown;
        },

        getImpactAssessment(issues) {
            const impacts = {
                screenReaders: 0,
                keyboardUsers: 0,
                visuallyImpaired: 0,
                motorImpaired: 0,
                cognitiveImpaired: 0
            };

            issues.forEach(issue => {
                switch (issue.category) {
                    case 'semantic':
                        impacts.screenReaders += issue.affectedElements;
                        break;
                    case 'keyboard':
                        impacts.keyboardUsers += issue.affectedElements;
                        break;
                    case 'visual':
                        impacts.visuallyImpaired += issue.affectedElements;
                        break;
                    case 'motor':
                        impacts.motorImpaired += issue.affectedElements;
                        break;
                    case 'cognitive':
                        impacts.cognitiveImpaired += issue.affectedElements;
                        break;
                }
            });

            return impacts;
        },

        generatePriorityRoadmap(issues) {
            const critical = issues.filter(i => i.severity === 'critical');
            const warning = issues.filter(i => i.severity === 'warning');
            const info = issues.filter(i => i.severity === 'info');

            return {
                phase1_immediate: {
                    description: 'Критические проблемы - исправить немедленно',
                    issues: critical.length,
                    estimatedTime: this.calculateTotalFixTime(critical) + ' минут',
                    focus: 'Функциональность и доступность'
                },
                phase2_important: {
                    description: 'Важные улучшения - следующие 2 недели',
                    issues: warning.length,
                    estimatedTime: this.calculateTotalFixTime(warning) + ' минут',
                    focus: 'Улучшение пользовательского опыта'
                },
                phase3_enhancement: {
                    description: 'Рекомендации - долгосрочные улучшения',
                    issues: info.length,
                    estimatedTime: this.calculateTotalFixTime(info) + ' минут',
                    focus: 'Оптимизация и соответствие AAA'
                }
            };
        },

        generateQuickWins(issues) {
            const quickWins = issues.filter(issue =>
                issue.automationPossible && ['missing-accessible-name', 'contrast-aa', 'touch-target-size'].includes(issue.issueType)
            );

            return quickWins.map(issue => ({
                type: issue.issueType,
                elements: issue.affectedElements,
                estimatedTime: this.getEstimatedFixTime(issue.issueType),
                automation: 'CSS/HTML changes',
                impact: 'High accessibility improvement'
            }));
        },

        generateAutomatedSolutions(issues) {
            const solutions = {};

            issues.filter(i => i.automationPossible).forEach(issue => {
                if (!solutions[issue.issueType]) {
                    solutions[issue.issueType] = {
                        description: issue.description,
                        solution: this.getAutomatedSolution(issue.issueType),
                        elements: []
                    };
                }
                solutions[issue.issueType].elements.push(...issue.fixes);
            });

            return solutions;
        },

        getAutomatedSolution(issueType) {
            const solutions = {
                'contrast-aa': 'Автоматическая коррекция цветов для достижения минимального контраста 4.5:1',
                'missing-accessible-name': 'Добавление aria-label атрибутов на основе контекста элемента',
                'touch-target-size': 'Увеличение padding для достижения минимального размера 44x44px',
                'focus-accessibility': 'Добавление CSS правил для видимого outline при фокусе'
            };

            return solutions[issueType] || 'Требуется ручная настройка';
        },

        generateTestingStrategy(issues) {
            const categories = [...new Set(issues.map(i => i.category))];

            return {
                automated: 'Использование accessibility scanners (axe-core, Pa11y, Lighthouse)',
                manual: 'Тестирование с клавиатуры, скрин-ридерами (NVDA, JAWS, VoiceOver)',
                userTesting: 'Привлечение пользователей с ограниченными возможностями',
                categories: categories.map(cat => ({
                    category: cat,
                    tools: this.getTestingTools(cat),
                    methods: this.getTestingMethods(cat)
                }))
            };
        },

        getTestingTools(category) {
            const tools = {
                'visual': ['Colour Contrast Analyser', 'Stark plugin', 'WebAIM Contrast Checker'],
                'keyboard': ['Keyboard navigation', 'Tab order testing', 'Focus indicators'],
                'semantic': ['NVDA', 'JAWS', 'VoiceOver', 'axe DevTools'],
                'motor': ['Switch navigation', 'Voice control', 'Touch target testing'],
                'cognitive': ['Reading level analysis', 'Plain language review', 'User testing']
            };

            return tools[category] || ['Manual testing'];
        },

        getTestingMethods(category) {
            const methods = {
                'visual': 'Проверка контрастности, цветовой дифференциации, увеличения до 200%',
                'keyboard': 'Навигация только с клавиатуры, проверка фокуса, ловушек фокуса',
                'semantic': 'Тестирование со скрин-ридерами, проверка структуры, меток',
                'motor': 'Проверка размеров касания, тайм-аутов, альтернативных методов ввода',
                'cognitive': 'Анализ сложности контента, понятности интерфейса, помощи пользователю'
            };

            return methods[category] || 'Общее тестирование доступности';
        },

        generateAccessibilityResources() {
            return {
                wcagGuidelines: 'https://www.w3.org/WAI/WCAG21/quickref/',
                testingTools: [
                    'https://www.deque.com/axe/',
                    'https://wave.webaim.org/',
                    'https://github.com/pa11y/pa11y'
                ],
                screenReaders: [
                    'NVDA (Windows, free)',
                    'JAWS (Windows, commercial)',
                    'VoiceOver (macOS/iOS, built-in)',
                    'TalkBack (Android, built-in)'
                ],
                learningResources: [
                    'WebAIM: https://webaim.org/',
                    'A11y Project: https://www.a11yproject.com/',
                    'MDN Accessibility: https://developer.mozilla.org/en-US/docs/Web/Accessibility'
                ]
            };
        },

        // === WCAG COMPLIANCE METHODS ===
        calculateWCAGScore() {
            const totalPossible = this.getAllWCAGCriteria().length;
            const failed = new Set(this.state.fixableIssues.map(i => i.wcagCriteria)).size;
            return Math.round(((totalPossible - failed) / totalPossible) * 100);
        },

        checkLevelCompliance(level) {
            const levelIssues = this.state.fixableIssues.filter(i => i.wcagLevel === level);
            return {
                passed: levelIssues.length === 0,
                failedCriteria: levelIssues.length,
                totalCriteria: this.getWCAGCriteriaForLevel(level).length
            };
        },

        getPrincipleIssues(principle) {
            const principleMap = {
                'perceivable': ['contrast-aa', 'contrast-aaa', 'missing-accessible-name'],
                'operable': ['focus-accessibility', 'touch-target-size', 'keyboard'],
                'understandable': ['readability-issues', 'invalid-role'],
                'robust': ['missing-required-state', 'aria-conflict']
            };

            const relevantIssues = this.state.fixableIssues.filter(issue =>
                principleMap[principle]?.some(type => issue.issueType.includes(type))
            );

            return {
                issueCount: relevantIssues.length,
                severity: this.categorizeBySeverity(relevantIssues),
                description: this.getPrincipleDescription(principle)
            };
        },

        getPrincipleDescription(principle) {
            const descriptions = {
                'perceivable': 'Информация и элементы интерфейса должны быть представлены в формате, который пользователи могут воспринимать',
                'operable': 'Элементы интерфейса и навигация должны быть управляемыми',
                'understandable': 'Информация и работа пользовательского интерфейса должны быть понятными',
                'robust': 'Контент должен быть достаточно надежным для интерпретации широким кругом пользовательских агентов'
            };

            return descriptions[principle] || '';
        },

        categorizeBySeverity(issues) {
            return {
                critical: issues.filter(i => i.severity === 'critical').length,
                warning: issues.filter(i => i.severity === 'warning').length,
                info: issues.filter(i => i.severity === 'info').length
            };
        },

        generateCriteriaStatus() {
            const allCriteria = this.getAllWCAGCriteria();
            const failedCriteria = new Set(this.state.fixableIssues.map(i => i.wcagCriteria));

            return allCriteria.map(criteria => ({
                criteria: criteria.name,
                level: criteria.level,
                status: failedCriteria.has(criteria.name) ? 'FAIL' : 'PASS',
                description: criteria.description
            }));
        },

        getAllWCAGCriteria() {
            return [{
                    name: '1.4.3 Contrast (Minimum)',
                    level: 'AA',
                    description: 'Text contrast ratio of at least 4.5:1'
                },
                {
                    name: '1.4.6 Contrast (Enhanced)',
                    level: 'AAA',
                    description: 'Text contrast ratio of at least 7:1'
                },
                {
                    name: '2.4.7 Focus Visible',
                    level: 'AA',
                    description: 'Keyboard focus indicator is visible'
                },
                {
                    name: '4.1.2 Name, Role, Value',
                    level: 'A',
                    description: 'Elements have accessible names and roles'
                },
                {
                    name: '2.5.5 Target Size',
                    level: 'AAA',
                    description: 'Touch targets are at least 44x44px'
                },
                {
                    name: '3.1.5 Reading Level',
                    level: 'AAA',
                    description: 'Content is readable at appropriate level'
                }
            ];
        },

        getWCAGCriteriaForLevel(level) {
            return this.getAllWCAGCriteria().filter(c => c.level === level);
        },

        generateWCAGRecommendations() {
            const recommendations = [];

            this.state.fixableIssues.forEach(issue => {
                if (issue.severity === 'critical') {
                    recommendations.push({
                        priority: 'High',
                        criterion: issue.wcagCriteria,
                        recommendation: `Address ${issue.issueType} affecting ${issue.affectedElements} elements`,
                        impact: issue.impact
                    });
                }
            });

            return recommendations.slice(0, 10); // Top 10 recommendations
        },

        // === ADVANCED TESTING FEATURES ===
        rerunContrastCheck() {
            this.showAccessibilityNotification('🔄 Перепроверяю контрастность...', 'info');

            // Clear previous contrast issues
            this.state.contrastIssues = [];
            this.state.fixableIssues = this.state.fixableIssues.filter(
                issue => !issue.issueType.includes('contrast')
            );

            // Re-run contrast analysis
            this.analyzeColorContrast();

            // Update interface
            const container = document.getElementById('a11y-issues-container');
            this.renderIssues(container, 'visual');

            this.showAccessibilityNotification('✅ Контрастность перепроверена', 'success');
        },

        simulateScreenReader() {
            this.showAccessibilityNotification('🔊 Запуск симуляции скрин-ридера...', 'info');

            const focusableElements = document.querySelectorAll(
                this.config.focusableElements.join(',')
            );

            const readingOrder = [];
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const landmarks = document.querySelectorAll('header, nav, main, section, article, aside, footer');

            // Create screen reader simulation
            console.group('🔊 Screen Reader Simulation');

            console.log('📑 Page Structure:');
            Array.from(headings).forEach((heading, index) => {
                const level = heading.tagName.charAt(1);
                const text = heading.textContent?.trim() || '(empty)';
                console.log(`  ${' '.repeat((parseInt(level) - 1) * 2)}H${level}: ${text}`);
            });

            console.log('\n🏛️ Landmarks:');
            Array.from(landmarks).forEach(landmark => {
                const role = landmark.getAttribute('role') || landmark.tagName.toLowerCase();
                const name = this.getAccessibleName(landmark) || '(unnamed)';
                console.log(`  ${role}: ${name}`);
            });

            console.log('\n⌨️ Focusable Elements:');
            Array.from(focusableElements).slice(0, 20).forEach((element, index) => {
                const name = this.getAccessibleName(element) || '(no accessible name)';
                const role = element.getAttribute('role') || element.tagName.toLowerCase();
                console.log(`  ${index + 1}. ${role}: ${name}`);
            });

            if (focusableElements.length > 20) {
                console.log(`  ... and ${focusableElements.length - 20} more focusable elements`);
            }

            console.groupEnd();

            this.showAccessibilityNotification(
                `📊 Симуляция завершена. Найдено ${headings.length} заголовков, ${landmarks.length} landmarks, ${focusableElements.length} фокусируемых элементов`,
                'success'
            );
        },

        reanalyzeWithLevel(level) {
            this.state.wcagLevel = level;

            // Re-filter issues based on level
            const container = document.getElementById('a11y-issues-container');
            this.renderIssues(container, 'all');

            // Update stats
            this.updateStatsDashboard();
        },

        updateStatsDashboard() {
            const stats = document.querySelector('#accessibility-analyzer-results > div:nth-child(2)');
            if (stats) {
                const newStats = this.createStatsDashboard();
                stats.innerHTML = newStats.innerHTML;
            }
        },

        // === CLEANUP AND UTILITIES ===
        clearHighlights() {
            this.state.highlightedElements.forEach(overlay => {
                overlay.style.opacity = '0';
                overlay.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 300);
            });
            this.state.highlightedElements.clear();

            // Remove pulse styles
            const pulseStyles = document.getElementById('a11y-pulse-styles');
            if (pulseStyles) {
                pulseStyles.remove();
            }
        },

        getSeverityColor(severity) {
            const colors = {
                critical: '#ff4757',
                warning: '#ffa502',
                info: '#3742fa'
            };
            return colors[severity] || '#666';
        },

        showAccessibilityNotification(message, type = 'info') {
            const notification = document.createElement('div');

            const colors = {
                success: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
                info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                warning: 'linear-gradient(135deg, #ffa502 0%, #ff6348 100%)',
                error: 'linear-gradient(135deg, #ff4757 0%, #ff3838 100%)'
            };

            notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-30px);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 16px 24px;
        border-radius: 10px;
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 13px;
        font-weight: 500;
        z-index: 10003;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        backdrop-filter: blur(15px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 500px;
        text-align: center;
        border: 1px solid rgba(255,255,255,0.1);
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
                notification.style.transform = 'translateX(-50%) translateY(-30px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 400);
            }, 4000);
        },

        exportAccessibilityReport() {
            console.group('♿ Complete Accessibility Analysis Report');

            // Executive Summary
            console.log('📊 Executive Summary:');
            console.table({
                'Total Issues': this.state.fixableIssues.length,
                'Critical Issues': this.state.fixableIssues.filter(i => i.severity === 'critical').length,
                'WCAG Level': this.state.wcagLevel,
                'Compliance Score': this.calculateWCAGScore() + '%',
                'Automation Possible': this.state.fixableIssues.filter(i => i.automationPossible).length
            });

            // Detailed breakdown by category
            ['visual', 'keyboard', 'semantic', 'motor', 'cognitive'].forEach(category => {
                const categoryIssues = this.state.fixableIssues.filter(i => i.category === category);
                if (categoryIssues.length > 0) {
                    console.group(`${this.getCategoryIcon(category)} ${category.toUpperCase()} Issues (${categoryIssues.length})`);

                    categoryIssues.forEach(issue => {
                        console.log(`${this.getSeverityIcon(issue.severity)} ${issue.description}`);
                        console.log(`   WCAG: ${issue.wcagCriteria} (${issue.wcagLevel})`);
                        console.log(`   Elements: ${issue.affectedElements} | Impact: ${issue.impact}`);
                        console.log(`   Automation: ${issue.automationPossible ? '✅ Yes' : '❌ Manual'}`);
                    });

                    console.groupEnd();
                }
            });

            // Testing recommendations
            console.log('\n🧪 Testing Recommendations:');
            console.log('1. Run axe-core DevTools extension');
            console.log('2. Test with keyboard navigation only');
            console.log('3. Test with screen readers (NVDA, JAWS, VoiceOver)');
            console.log('4. Verify color contrast with tools');
            console.log('5. Test on mobile devices for touch targets');

            console.groupEnd();

            this.showAccessibilityNotification('📊 Полный отчет выведен в консоль', 'success');
        },

        getCategoryIcon(category) {
            const icons = {
                'visual': '👁️',
                'keyboard': '⌨️',
                'semantic': '🏷️',
                'motor': '🤲',
                'cognitive': '🧠'
            };
            return icons[category] || '❓';
        },

        getSeverityIcon(severity) {
            const icons = {
                'critical': '🚨',
                'warning': '⚠️',
                'info': '💡'
            };
            return icons[severity] || '📋';
        },

        getEstimatedFixTime(issueType) {
            const times = {
                'contrast-aa': '5-10 мин',
                'contrast-aaa': '5-10 мин',
                'focus-accessibility': '10-15 мин',
                'missing-accessible-name': '3-8 мин',
                'missing-required-state': '2-5 мин',
                'touch-target-size': '8-12 мин',
                'readability-issues': '15-30 мин',
                'invalid-role': '5-10 мин',
                'aria-conflict': '5-15 мин'
            };
            return times[issueType] || '5-15 мин';
        },

        generateCodeExample(fix, issueType) {
            const examples = {
                'contrast-aa': `/* Улучшение контраста */\n${fix.selector} {\n  color: ${fix.suggestedFix.color || '#000'};\n  background-color: ${fix.suggestedFix['background-color'] || '#fff'};\n}`,
                'missing-accessible-name': `<!-- Добавление доступного имени -->\n<${fix.tagName} aria-label="${fix.suggestedFix['aria-label'] || 'Описание элемента'}">`,
                'focus-accessibility': `/* Улучшение фокуса */\n${fix.selector}:focus {\n  outline: 2px solid #005fcc;\n  outline-offset: 2px;\n}`,
                'touch-target-size': `/* Увеличение области касания */\n${fix.selector} {\n  min-width: 44px;\n  min-height: 44px;\n  padding: 8px;\n}`,
                'missing-required-state': `<!-- Добавление состояния -->\n<${fix.tagName} aria-expanded="false" aria-checked="false">`,
                'readability-issues': `/* Улучшение читаемости */\n${fix.selector} {\n  font-size: ${fix.suggestedFix['font-size'] || '16px'};\n  line-height: ${fix.suggestedFix['line-height'] || '1.5'};\n  max-width: 75ch;\n}`
            };

            return examples[issueType] || `/* Исправление для ${issueType} */\n${fix.selector} {\n  /* Добавить соответствующие CSS правила */\n}`;
        },

        generateTestingInstructions(issueType) {
            const instructions = {
                'contrast-aa': '1. Используйте WebAIM Contrast Checker\n2. Проверьте соотношение текста и фона\n3. Убедитесь что соотношение ≥ 4.5:1',
                'missing-accessible-name': '1. Включите скрин-ридер (NVDA/JAWS)\n2. Перейдите на элемент с Tab\n3. Убедитесь что элемент объявляется правильно',
                'focus-accessibility': '1. Используйте только клавиатуру\n2. Нажмите Tab для навигации\n3. Убедитесь что фокус видим на каждом элементе',
                'touch-target-size': '1. Протестируйте на мобильном устройстве\n2. Проверьте что элемент легко нажимается пальцем\n3. Убедитесь что нет случайных нажатий',
                'readability-issues': '1. Прочтите текст вслух\n2. Проверьте на простоту понимания\n3. Используйте инструменты проверки читаемости'
            };

            return instructions[issueType] || 'Выполните ручное тестирование доступности';
        },

        cleanup() {
            this.clearHighlights();

            const container = document.getElementById('accessibility-analyzer-results');
            if (container) {
                container.style.opacity = '0';
                container.style.transform = 'translateY(-20px) scale(0.95)';
                setTimeout(() => {
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 300);
            }

            // Clean up color cache
            this.state.colorCache.clear();

            // Remove any remaining styles
            const pulseStyles = document.getElementById('a11y-pulse-styles');
            if (pulseStyles) {
                pulseStyles.remove();
            }
        },

        // === MAIN EXECUTION METHOD ===
        run() {
            console.log('🚀 Starting Comprehensive Accessibility Analysis...');

            // Show loading notification
            this.showAccessibilityNotification('🔍 Выполняю глубокий анализ доступности WCAG 2.1...', 'info');

            // Clear previous results
            this.state = {
                contrastIssues: [],
                focusIssues: [],
                ariaIssues: [],
                keyboardIssues: [],
                readabilityIssues: [],
                allIssues: [],
                fixableIssues: [],
                highlightedElements: new Set(),
                wcagLevel: 'AA',
                colorCache: new Map()
            };

            this.cleanup();

            try {
                // Run comprehensive analysis
                this.analyzeAccessibility();

                // Consolidate all issues into fixableIssues for interface
                this.consolidateIssues();

                setTimeout(() => {
                    const wcagScore = this.calculateWCAGScore();
                    
                    if (this.state.fixableIssues.length === 0) {
                        console.log('✅ Accessibility Analysis Complete: No issues found!');
                        
                        if (wcagScore === 0) {
                            this.showAccessibilityNotification('⚠️ WCAG Compliance: 0% - Используйте вкладки экспорта для анализа', 'warning');
                        } else {
                            this.showAccessibilityNotification('🎉 Превосходно! Серьезных проблем с доступностью не найдено.', 'success');
                        }

                        // Show success interface (will show full interface if WCAG score is low)
                        this.createSuccessInterface();
                        return;
                    }

                    // Create full analysis interface (including when WCAG score is 0%)
                    this.createAccessibilityInterface();

                    const criticalCount = this.state.fixableIssues.filter(i => i.severity === 'critical').length;

                    console.log(`♿ Accessibility Analysis complete. Found ${this.state.fixableIssues.length} issues to address.`);
                    console.log(`📊 WCAG Compliance Score: ${wcagScore}%`);

                    // Show completion notification
                    const message = criticalCount > 0 ?
                        `🚨 Найдено ${this.state.fixableIssues.length} проблем (${criticalCount} критических) • WCAG: ${wcagScore}%` :
                        `📋 Найдено ${this.state.fixableIssues.length} рекомендаций для улучшения • WCAG: ${wcagScore}%`;

                    this.showAccessibilityNotification(message, criticalCount > 0 ? 'warning' : 'info');
                }, 1000);

            } catch (error) {
                console.error('Accessibility Analysis Error:', error);
                this.showAccessibilityNotification('❌ Ошибка при анализе доступности. Проверьте консоль.', 'error');
            }
        },

        // Consolidate all issue types into fixableIssues array
        consolidateIssues() {
            // Add contrast issues
            this.state.contrastIssues.forEach(issue => {
                if (!this.state.fixableIssues.find(f => f.issueType === issue.type &&
                        f.fixes.some(fix => fix.selector === this.generateSelector(issue.element)))) {
                    // Already added in addContrastIssue method
                }
            });

            // Add focus issues  
            this.state.focusIssues.forEach(issue => {
                // Already added in addFocusIssue method
            });

            // Add ARIA issues
            this.state.ariaIssues.forEach(issue => {
                // Already added in addAriaIssue method
            });

            // Add keyboard issues
            this.state.keyboardIssues.forEach(issue => {
                this.createFixableIssue(
                    'keyboard-navigation',
                    issue.severity,
                    issue.elements, {
                        'issue': issue.type
                    }, {
                        'review': 'Требуется ручная проверка навигации'
                    },
                    issue.description
                );
            });

            // Add readability issues
            this.state.readabilityIssues.forEach(issue => {
                // Already added in addReadabilityIssue method
            });

            // Add screen reader issues
            this.state.allIssues.forEach(issue => {
                if (issue.type === 'screen-reader') {
                    this.createFixableIssue(
                        issue.subType,
                        issue.severity,
                        issue.elements, {
                            'issue': issue.subType
                        }, {
                            'review': 'Требуется ручное исправление'
                        },
                        issue.description
                    );
                }
            });
        },

        // Create success interface for when no issues found
        createSuccessInterface() {
            const wcagScore = this.calculateWCAGScore();
            const isLowScore = wcagScore < 50;
            
            const container = document.createElement('div');
            container.id = 'accessibility-success-results';
            container.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: ${isLowScore ? '650px' : '400px'};
        max-height: 80vh;
        background: linear-gradient(135deg, ${isLowScore ? '#1a1a2e 0%, #16213e 100%' : '#00d2ff 0%, #3a7bd5 100%'});
        border: 2px solid ${isLowScore ? '#0f3460' : 'transparent'};
        border-radius: 16px;
        color: white;
        font-family: 'SF Mono', Consolas, monospace;
        text-align: center;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        backdrop-filter: blur(20px);
        animation: ${isLowScore ? 'none' : 'successPulse 2s ease-in-out infinite alternate'};
      `;

            if (isLowScore) {
                // Show full interface with export tabs for low scores
                const header = this.createHeader();
                const stats = this.createStatsDashboard();
                const filterTabs = this.createFilterTabs();
                const issuesContainer = document.createElement('div');
                issuesContainer.id = 'a11y-issues-container';
                issuesContainer.style.cssText = 'padding: 12px; max-height: 450px; overflow-y: auto;';
                const controls = this.createControls();

                container.appendChild(header);
                container.appendChild(stats);
                container.appendChild(filterTabs);
                container.appendChild(issuesContainer);
                container.appendChild(controls);

                this.setupEventListeners(container);
                
                // Show special message for 0% score
                if (wcagScore === 0) {
                    issuesContainer.innerHTML = `
                        <div style="padding: 40px 20px; text-align: center; color: #ff4757;">
                            <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                            <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px;">WCAG Compliance: 0%</div>
                            <div style="font-size: 14px; color: #ccc; margin-bottom: 20px;">
                                Обнаружены серьезные проблемы с доступностью.<br>
                                Используйте вкладки выше для экспорта и анализа проблем.
                            </div>
                            <div style="background: rgba(255,71,87,0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,71,87,0.3); font-size: 12px;">
                                💡 Рекомендуется начать с критических проблем<br>
                                📊 Используйте вкладку "Экспорт" для получения детального отчета
                            </div>
                        </div>
                    `;
                } else {
                    this.renderIssues(issuesContainer, 'all');
                }
            } else {
                // Show simple success message for high scores
                container.innerHTML = `
        <div style="padding: 40px 30px;">
          <div style="font-size: 80px; margin-bottom: 20px;">🏆</div>
          <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">Отличная доступность!</div>
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 20px;">
            WCAG ${this.state.wcagLevel} Compliance: ${wcagScore}%
          </div>
          <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-bottom: 20px; font-size: 12px;">
            ✅ Контрастность текста<br>
            ✅ Фокусируемость элементов<br>
            ✅ ARIA разметка<br>
            ✅ Семантическая структура<br>
            ✅ Размеры касания
          </div>
          <button id="close-success" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 20px; border-radius: 25px; cursor: pointer; font-family: inherit;">
            Закрыть
          </button>
        </div>
      `;
            }

            // Add success animation styles
            const style = document.createElement('style');
            style.textContent = `
        @keyframes successPulse {
          0% { box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 0 rgba(58,123,213,0.4); }
          100% { box-shadow: 0 25px 80px rgba(0,0,0,0.4), 0 0 0 20px rgba(58,123,213,0); }
        }
      `;
            document.head.appendChild(style);

            // Add event listener for close button
            const closeButton = container.querySelector('#close-success') || container.querySelector('#close-a11y-analyzer');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    if (isLowScore) {
                        this.cleanup();
                    } else {
                        container.style.opacity = '0';
                        container.style.transform = 'translate(-50%, -50%) scale(0.8)';
                        setTimeout(() => {
                            if (container.parentNode) {
                                container.parentNode.removeChild(container);
                            }
                            if (style && style.parentNode) {
                                style.parentNode.removeChild(style);
                            }
                        }, 300);
                    }
                });
            }

            document.body.appendChild(container);
        }
    };

    // Launch the comprehensive accessibility analyzer
    ACCESSIBILITY_ANALYZER.run();
})();
