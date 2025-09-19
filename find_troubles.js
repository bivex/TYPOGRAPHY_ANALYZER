(() => {
  const issues = [];
  const seenFonts = new Map();

  // Функция для генерации уникального CSS-селектора элемента
  function getCssSelector(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let classNames = Array.from(el.classList);
        if (classNames.length > 0) selector += '.' + classNames.join('.');
        let sib = el, nth = 1;
        while (sib.previousElementSibling) {
          sib = sib.previousElementSibling;
          if (sib.nodeName === el.nodeName && Array.from(sib.classList).every(c => el.classList.contains(c))) nth++;
        }
        if (nth !== 1) selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  // Сбор всех стилей на странице
  document.querySelectorAll("*").forEach(el => {
    const style = getComputedStyle(el);
    const fontFamily = style.fontFamily;
    const fontSize = style.fontSize;
    const fontWeight = style.fontWeight;
    const lineHeight = style.lineHeight;

    const key = `${fontFamily} | ${fontSize} | ${fontWeight} | ${lineHeight}`;
    if (!seenFonts.has(key)) seenFonts.set(key, []);
    seenFonts.get(key).push(el);
  });

  // Анализ стилей
  seenFonts.forEach((elements, key) => {
    const [fontFamily, fontSize, fontWeight, lineHeight] = key.split(" | ");
    const exampleElement = elements[0];
    const fullCssPath = getCssSelector(exampleElement);

    const primaryFont = fontFamily.split(',')[0].trim().toLowerCase();
    const hasInter = fontFamily.toLowerCase().includes('inter');
    const hasSansSerif = fontFamily.toLowerCase().includes('sans-serif');
    const hasSerif = fontFamily.toLowerCase().includes('serif');
    const hasMaterialSymbols = fontFamily.toLowerCase().includes('material symbols sharp');
    const hasFontAwesome = fontFamily.toLowerCase().includes('fontawesome');
    const hasMonospace = fontFamily.toLowerCase().includes('monospace');

    let isMixedFamily = false;
    if ((hasSansSerif || hasSerif) && !hasInter && !hasMaterialSymbols && !hasFontAwesome && !hasMonospace) isMixedFamily = true;
    if (fontFamily.includes("serif") && fontFamily.includes("sans")) isMixedFamily = true;
    if (hasInter && primaryFont !== 'inter' && !hasMaterialSymbols && !hasFontAwesome) isMixedFamily = true;

    if (isMixedFamily) issues.push({ type: "⚠️ Смешанные семейства", detail: key, example: fullCssPath });
    if (parseFloat(lineHeight) === 0) issues.push({ type: "💥 line-height: 0px", detail: key, example: fullCssPath });
    else if (parseFloat(lineHeight) < parseFloat(fontSize) * 1.2) issues.push({ type: "📏 Маленький line-height", detail: key, example: fullCssPath });
    if (parseFloat(fontSize) === 0) issues.push({ type: "💥 font-size: 0px", detail: key, example: fullCssPath });
    if (fontWeight === "100" || fontWeight === "900") issues.push({ type: "💡 Экстремальный font-weight", detail: key, example: fullCssPath });
    if (elements.length === 1 && !hasMaterialSymbols && !hasFontAwesome) issues.push({ type: "🔍 Уникальный стиль (только у 1 элемента)", detail: key, example: fullCssPath });
  });

  // Вывод таблицы
  console.table(issues.map(issue => ({
    "Проблема": issue.type,
    "Стили": issue.detail,
    "Пример элемент": issue.example
  })));
  console.log("✅ Проверка завершена. Если таблица пустая — критичных проблем не найдено.");

  // Сбор загруженных CSS
  const loadedStylesheets = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => loadedStylesheets.push({ type: 'Link (external stylesheet)', source: link.href }));
  document.querySelectorAll('style').forEach(style => {
    const contentPreview = style.innerHTML.substring(0, 100).trim();
    loadedStylesheets.push({ type: 'Style tag (inline/embedded)', source: `(Content preview: ${contentPreview}...)` });
  });
  console.log("\n--- Загруженные CSS-источники ---");
  console.table(loadedStylesheets);

  // 📋 Копирование в буфер обмена через textarea
  const textReport = issues.map(issue => `${issue.type}\n  Стили: ${issue.detail}\n  Пример: ${issue.example}`).join("\n\n") || "✅ Проблем не найдено";

  (function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      console.log("📋 Отчет скопирован в буфер обмена.");
    } catch (err) {
      console.warn("Не удалось скопировать в буфер:", err);
    }
    document.body.removeChild(textarea);
  })(textReport);

})();
