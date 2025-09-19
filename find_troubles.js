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
    const hasMonospace = fontFamily.toLowerCase().includes('monospace');


    let isMixedFamily = false;
    // Если sans-serif присутствует, но Inter или иконные шрифты не являются основными, это может быть смешанным.
    // Исключаем monospace, так как это может быть преднамеренно для кода.
    if (hasSansSerif && !hasInter && !hasMaterialSymbols && !hasFontAwesome && !hasMonospace) {
        isMixedFamily = true;
    }
    // Если serif присутствует, а Inter или иконные шрифты не являются основными.
    if (hasSerif && !hasInter && !hasMaterialSymbols && !hasFontAwesome && !hasMonospace) {
        isMixedFamily = true;
    }
    // Старая проверка: если в одном fontFamily есть и "serif", и "sans".
    if (fontFamily.includes("serif") && fontFamily.includes("sans")) {
        isMixedFamily = true;
    }
     // Проверяем, если Inter присутствует, но не является первым в списке, и при этом первый шрифт не является иконным
    if (hasInter && primaryFont !== 'inter' && !hasMaterialSymbols && !hasFontAwesome) {
        isMixedFamily = true;
    }

    if (isMixedFamily) {
      issues.push({ type: "⚠️ Смешанные семейства", detail: key, example: fullCssPath });
    }

    if (parseFloat(lineHeight) === 0) {
        issues.push({ type: "💥 line-height: 0px", detail: key, example: fullCssPath });
    } else if (parseFloat(lineHeight) < parseFloat(fontSize) * 1.2) {
      issues.push({ type: "📏 Маленький line-height", detail: key, example: fullCssPath });
    }
    if (parseFloat(fontSize) === 0) {
        issues.push({ type: "💥 font-size: 0px", detail: key, example: fullCssPath });
    }
    if (fontWeight === "100" || fontWeight === "900") {
      issues.push({ type: "💡 Экстремальный font-weight", detail: key, example: fullCssPath });
    }
    // Только сообщать об уникальном стиле, если это не иконный шрифт, так как иконные шрифты могут быть по праву уникальными.
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

  // Собираем информацию о загруженных CSS файлах
  const loadedStylesheets = [];

  // Извлекаем <link> теги
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    loadedStylesheets.push({ type: 'Link (external stylesheet)', source: link.href });
  });

  // Извлекаем <style> теги
  document.querySelectorAll('style').forEach((style, index) => {
    // Для <style> тегов можно показать часть содержимого или указать, что это внутренние стили
    const contentPreview = style.innerHTML.substring(0, 100).trim();
    loadedStylesheets.push({ type: `Style tag (inline/embedded)`, source: `(Content preview: ${contentPreview}...)` });
  });

  console.log("\n--- Загруженные CSS-источники ---");
  console.table(loadedStylesheets);

})();
