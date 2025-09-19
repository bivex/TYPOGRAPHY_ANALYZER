(() => {
  const issues = [];
  const seenFonts = new Map();

  // Function to generate a unique CSS selector for an element
  function getCssSelector(el) {
    if (!(el instanceof Element)) {
      return '';
    }
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let classNames = Array.from(el.classList);
        if (classNames.length > 0) {
          selector += '.' + classNames.join('.');
        }
        let sib = el, nth = 1;
        while (sib.previousElementSibling) {
          sib = sib.previousElementSibling;
          // Check if previous sibling is of the same node name and has similar classes to avoid incorrect nth-of-type
          // This part is a bit simplified and might not be perfect for all complex cases
          if (sib.nodeName === el.nodeName && Array.from(sib.classList).every(c => el.classList.contains(c))) {
             nth++;
          }
        }
        if (nth !== 1) {
            selector += `:nth-of-type(${nth})`;
        }
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  document.querySelectorAll("*").forEach(el => {
    const style = getComputedStyle(el);
    const fontFamily = style.fontFamily;
    const fontSize = style.fontSize;
    const fontWeight = style.fontWeight;
    const lineHeight = style.lineHeight;

    const key = `${fontFamily} | ${fontSize} | ${fontWeight} | ${lineHeight}`;

    if (!seenFonts.has(key)) {
      seenFonts.set(key, []);
    }
    seenFonts.get(key).push(el);
  });

  // Анализируем собранные комбинации
  seenFonts.forEach((elements, key) => {
    const [fontFamily, fontSize, fontWeight, lineHeight] = key.split(" | ");

    // Потенциальные "проблемы"
    const exampleElement = elements[0];
    const fullCssPath = getCssSelector(exampleElement);

    // Улучшенная проверка на смешанные семейства
    const primaryFont = fontFamily.split(',')[0].trim().toLowerCase();
    const hasInter = fontFamily.toLowerCase().includes('inter');
    const hasSansSerif = fontFamily.toLowerCase().includes('sans-serif');
    const hasSerif = fontFamily.toLowerCase().includes('serif');
    const hasMaterialSymbols = fontFamily.toLowerCase().includes('material symbols sharp');
    const hasFontAwesome = fontFamily.toLowerCase().includes('fontawesome');


    let isMixedFamily = false;
    if (hasSansSerif && !hasInter && !hasMaterialSymbols && !hasFontAwesome) { // If sans-serif is present but Inter or icon fonts are not the primary, it might be mixed.
        isMixedFamily = true;
    }
    if (hasSerif && !hasInter && !hasMaterialSymbols && !hasFontAwesome) { // If serif is present and Inter or icon fonts are not primary.
        isMixedFamily = true;
    }
    if (fontFamily.includes("serif") && fontFamily.includes("sans")) { // Old check
        isMixedFamily = true;
    }

    if (isMixedFamily) {
      issues.push({ type: "⚠️ Смешанные семейства", detail: key, example: fullCssPath });
    }

    if (parseFloat(lineHeight) < parseFloat(fontSize) * 1.2) {
      issues.push({ type: "📏 Маленький line-height", detail: key, example: fullCssPath });
    }
    if (fontWeight === "100" || fontWeight === "900") {
      issues.push({ type: "💡 Экстремальный font-weight", detail: key, example: fullCssPath });
    }
    // Only report unique style if it's not an icon font, as icon fonts might legitimately be unique.
    if (elements.length === 1 && !hasMaterialSymbols && !hasFontAwesome) {
      issues.push({ type: "🔍 Уникальный стиль (только у 1 элемента)", detail: key, example: fullCssPath });
    }
  });

  // Выводим таблицу
  console.table(
    issues.map(issue => ({
      "Проблема": issue.type,
      "Стили": issue.detail,
      "Пример элемент": issue.example // Теперь это полный CSS-путь
    }))
  );

  console.log("✅ Проверка завершена. Если таблица пустая — критичных проблем не найдено.");
})();
