(() => {
  const issues = [];
  const seenFonts = new Map();

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
    if (fontFamily.includes("serif") && fontFamily.includes("sans")) {
      issues.push({ type: "⚠️ Смешанные семейства", detail: key, example: elements[0] });
    }
    if (parseFloat(lineHeight) < parseFloat(fontSize) * 1.2) {
      issues.push({ type: "📏 Маленький line-height", detail: key, example: elements[0] });
    }
    if (fontWeight === "100" || fontWeight === "900") {
      issues.push({ type: "💡 Экстремальный font-weight", detail: key, example: elements[0] });
    }
    if (elements.length === 1) {
      issues.push({ type: "🔍 Уникальный стиль (только у 1 элемента)", detail: key, example: elements[0] });
    }
  });

  // Выводим таблицу
  console.table(
    issues.map(issue => ({
      "Проблема": issue.type,
      "Стили": issue.detail,
      "Пример элемент": `<${issue.example.tagName.toLowerCase()} class="${issue.example.className}">`
    }))
  );

  console.log("✅ Проверка завершена. Если таблица пустая — критичных проблем не найдено.");
})();
