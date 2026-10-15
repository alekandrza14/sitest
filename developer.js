/* Бесплатная выдача сертификата разработчика, отдельно от платёжной формы. */
(() => {
  "use strict";
  const api = window.MyEngineDeveloper;
  const settings = window.MYENGINE_CONFIG?.developerAccess;
  const product = window.MyEngineStore?.selected;
  const block = document.getElementById("developer-access");
  if (!api || !product || !api.isConfigured(settings)) return;
  block.hidden = false;
  const form = document.getElementById("developer-form");
  const button = document.getElementById("developer-issue");
  const status = document.getElementById("developer-message");
  const id = document.getElementById("developer-player");
  const card = document.getElementById("developer-last4");
  const phone = document.getElementById("developer-phone");
  const result = document.getElementById("developer-result");
  const download = document.getElementById("developer-download");
  let certificate = null;
  let busy = false;

  function invalidate() {
    certificate = null;
    result.hidden = true;
    status.textContent = "";
  }
  [id, card, phone].forEach(input => input.addEventListener("input", invalidate));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    invalidate();
    if (!form.reportValidity()) return;
    const entered = { id: id.value.trim(), last4: card.value.trim(), phone: phone.value };
    busy = true;
    button.disabled = true;
    status.textContent = "Проверяем совпадение…";
    try {
      const next = await api.issue(settings, entered.id, entered.last4, entered.phone, product);
      // Не показываем результат старой проверки, если данные поменяли во время SHA-256.
      if (id.value.trim() !== entered.id || card.value.trim() !== entered.last4 || phone.value !== entered.phone) {
        status.textContent = "Данные изменились. Нажмите кнопку ещё раз.";
        return;
      }
      certificate = next;
      card.value = "";
      phone.value = "";
      document.getElementById("certificate-player").textContent = next.playerId;
      document.getElementById("certificate-id").textContent = next.certificateId;
      document.getElementById("certificate-date").textContent = new Date(next.issuedAt).toLocaleString("ru-RU");
      result.hidden = false;
      status.textContent = "Сертификат разработчика готов. Списания не было.";
      result.focus({ preventScroll: true });
    } catch (error) {
      status.textContent = error.message || "Не удалось создать сертификат.";
    } finally {
      entered.last4 = "";
      entered.phone = "";
      busy = false;
      button.disabled = false;
    }
  });
  download.addEventListener("click", () => {
    if (!certificate) return;
    const blob = new Blob([JSON.stringify(certificate, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${certificate.productId}-${certificate.playerId}-${certificate.certificateId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  window.addEventListener("pagehide", () => { card.value = ""; phone.value = ""; });
})();
