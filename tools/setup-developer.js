(() => {
  "use strict";
  const api = window.MyEngineDeveloper;
  const original = window.MYENGINE_CONFIG;
  const form = document.getElementById("setup-form");
  const button = document.getElementById("setup-generate");
  const status = document.getElementById("setup-message");
  const id = document.getElementById("setup-player");
  const card = document.getElementById("setup-last4");
  const phone = document.getElementById("setup-phone");
  const result = document.getElementById("setup-result");
  let output = null;
  let busy = false;
  if (!api || !original) {
    status.textContent = "Не найдены config.js или developer-core.js. Распакуйте весь архив, сохранив папки, и откройте tools/setup-developer.html.";
    return;
  }
  if (!globalThis.crypto?.subtle) {
    status.textContent = "Откройте файл в актуальном Chrome или Edge. Браузер должен поддерживать локальную проверку SHA-256.";
    return;
  }
  button.disabled = false;
  status.textContent = "Данные обрабатываются только локально.";
  id.value = original.developerAccess?.playerId || "";
  [id, card, phone].forEach(input => input.addEventListener("input", () => {
    output = null;
    result.hidden = true;
    status.textContent = "";
  }));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const entered = { id: id.value.trim(), last4: card.value.trim(), phone: phone.value };
    busy = true;
    button.disabled = true;
    output = null;
    result.hidden = true;
    try {
      const settings = await api.createSettings(entered.id, entered.last4, entered.phone);
      if (id.value.trim() !== entered.id || card.value.trim() !== entered.last4 || phone.value !== entered.phone) {
        status.textContent = "Данные изменились во время проверки. Нажмите кнопку ещё раз.";
        return;
      }
      const config = { ...original, developerAccess: settings };
      output = "/* Публичные настройки MyEngine. Последние цифры карты и телефон здесь не хранятся. */\n" +
        "window.MYENGINE_CONFIG = Object.freeze(" + JSON.stringify(config, null, 2) + ");\n";
      card.value = "";
      phone.value = "";
      document.getElementById("setup-summary").textContent = `Режим разработчика включён для ID ${settings.playerId}. Кошелёк ЮMoney и остальные настройки сохранены.`;
      result.hidden = false;
      status.textContent = "Скачайте config.js и загрузите его на свой сайт.";
    } catch (error) {
      status.textContent = error.message || "Не удалось подготовить настройки.";
    } finally {
      entered.last4 = "";
      entered.phone = "";
      busy = false;
      button.disabled = false;
    }
  });
  document.getElementById("setup-download").addEventListener("click", () => {
    if (!output) return;
    const url = URL.createObjectURL(new Blob([output], {type:"text/javascript;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "config.js";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  window.addEventListener("pagehide", () => { card.value = ""; phone.value = ""; });
})();
