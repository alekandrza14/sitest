/* Статическая платёжная форма. Этот код не подтверждает оплату и не выдаёт Deluxe. */
(() => {
  "use strict";
  const config = window.MYENGINE_CONFIG || {};
  const form = document.getElementById("payment-form");
  const button = document.getElementById("pay-button");
  const buttonLabel = document.getElementById("pay-button-label");
  const message = document.getElementById("form-message");
  const playerInput = document.getElementById("player-id");
  const receiver = typeof config.receiver === "string" ? config.receiver.trim() : "";
  const params = new URL(window.location.href).searchParams;
  const multi = Object.prototype.hasOwnProperty.call(config, "products");
  const items = multi ? config.products : [config];
  const validAmount = value => typeof value === "string" && /^(?:0|[1-9]\d{0,6})\.\d{2}$/.test(value) && Number(value) > 0 && Number(value) <= 1000000;
  const validProduct = item => item && typeof item === "object" && typeof item.productId === "string" &&
    /^[A-Za-z0-9_.-]{1,100}$/.test(item.productId) && validAmount(item.amount) &&
    (!multi || (typeof item.productTitle === "string" && item.productTitle.trim() &&
      typeof item.activationText === "string" && item.activationText.trim() && /^[a-f0-9]{10}$/.test(item.paymentCode)));
  const catalogValid = Array.isArray(items) && items.length > 0 && items.length <= 100 && items.every(validProduct) &&
    new Set(items.map(item => item.productId)).size === items.length &&
    (!multi || new Set(items.map(item => item.paymentCode)).size === items.length);
  const selected = catalogValid ? (params.has("product") ? items.find(item => item.productId === params.get("product")) : items[0]) : null;
  const product = selected?.productId || "";
  const amount = selected?.amount || "";
  const amountValid = validAmount(amount);
  const displayAmount = amountValid ? Number(amount).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : "—";
  const productValid = !!selected;
  const productMatches = !!selected;
  // Shared immutable selection: the developer certificate must use this same product.
  window.MyEngineStore = Object.freeze({ selected: selected ? Object.freeze({ ...selected, gameName: config.gameName }) : null });
  const display = { title: selected?.productTitle || (selected ? product : "Товар не найден"),
    price: displayAmount, description: selected?.description || (selected ? "" : "Выберите товар из каталога выше."), id: product || "—" };
  document.querySelectorAll("[data-product-field]").forEach(node => {
    if (Object.prototype.hasOwnProperty.call(display, node.dataset.productField)) node.textContent = display[node.dataset.productField];
  });
  document.title = `${config.gameName || "Магазин"} · ${display.title}`;
  document.querySelectorAll("[data-catalog-product]").forEach(link => {
    if (link.dataset.catalogProduct === product) link.setAttribute("aria-current", "true");
    // Each link starts a different purchase; never carry another product's requestId or return flag.
    const target = new URL(window.location.href);
    target.search = ""; target.hash = "checkout";
    target.searchParams.set("product", link.dataset.catalogProduct);
    link.href = target.href;
    link.addEventListener("click", () => {
      const player = playerInput.value.trim();
      if (/^[A-Za-z0-9_.-]{1,32}$/.test(player)) target.searchParams.set("playerId", player);
      else target.searchParams.delete("playerId");
      link.href = target.href;
    });
  });
  const storageKey = "myengine.payment.pending.v2." + receiver + "." + product;
  const idPattern = /^[A-Za-z0-9_.-]{1,32}$/;
  let submitting = false;

  function supportAddress(value) {
    if (typeof value !== "string" || /[\r\n]/.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.username || url.password) return null;
      if (url.protocol === "https:" && url.hostname) return url.href;
      if (url.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname)) return url.href;
    } catch (_) { /* Не используем непроверенный адрес. */ }
    return null;
  }

  function readPending() {
    try {
      const item = JSON.parse(sessionStorage.getItem(storageKey));
      if (item && item.product === product && typeof item.player === "string" && idPattern.test(item.player) &&
          typeof item.label === "string" && /^(?:DLX-[A-Za-z0-9_.-]{1,59}|ME-(?:[a-f0-9]{10}-)?[a-f0-9]{32}|MP-[a-f0-9]{10}-[A-Za-z0-9_.-]{1,32}-[a-f0-9]{12})$/.test(item.label) &&
          item.label.length <= 64 && Number.isFinite(item.createdAt) &&
          item.createdAt <= Date.now() && Date.now() - item.createdAt < 7 * 86400000) return item;
    } catch (_) { /* Оплата работает и при недоступном хранилище браузера. */ }
    return null;
  }

  const support = supportAddress(config.supportUrl);
  const activation = typeof selected?.activationText === "string" ? selected.activationText.trim() : "";
  const configured = config.paymentsEnabled === true && amountValid && productValid && /^4100\d{7,16}$/.test(receiver) && !!support && !!activation;
  const published = window.location.protocol === "https:";
  const ready = configured && published && productMatches;

  if (support) {
    document.querySelectorAll(".support-link").forEach(link => {
      link.href = support;
      if (support.startsWith("https:")) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
      link.hidden = false;
    });
    document.getElementById("support-placeholder").hidden = true;
  }
  if (activation) document.getElementById("activation-text").textContent = activation;

  function restoreButton() {
    submitting = false;
    button.disabled = !ready;
    buttonLabel.textContent = ready ? `Оплатить ${displayAmount} ₽` : "Оплата скоро появится";
    message.textContent = !productMatches ? "Товар по ссылке не совпадает с каталогом сайта. Выберите товар из каталога или обратитесь к разработчику." : ready ? "" : configured && !published
      ? "Предпросмотр: оплата доступна после публикации сайта по HTTPS."
      : "Приём платежей пока не подключён.";
  }
  restoreButton();
  document.getElementById("preview-banner").hidden = ready;
  window.addEventListener("pageshow", restoreButton);

  if (idPattern.test(params.get("playerId") || "")) playerInput.value = params.get("playerId");
  playerInput.addEventListener("input", () => playerInput.setCustomValidity(""));
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (submitting) return;
    if (!ready) { restoreButton(); return; }
    const player = playerInput.value.trim();
    playerInput.value = player;
    playerInput.setCustomValidity(idPattern.test(player) ? "" : "Введите ID: до 32 латинских букв, цифр или символов . _ -");
    if (!form.reportValidity()) return;
    const method = form.querySelector('input[name="paymentType"]:checked');
    if (!method || !["PC", "AC"].includes(method.value)) {
      message.textContent = "Выберите кошелёк ЮMoney или банковскую карту.";
      return;
    }

    try {
      const random = new Uint32Array(2);
      window.crypto.getRandomValues(random);
      const requestId = params.get("product") === product ? params.get("requestId") : null;
      const suffix = Array.from(random, n => n.toString(16).padStart(8, "0")).join("").slice(0, 12);
      const label = multi
        ? (/^[a-f0-9]{32}$/.test(requestId || "") ? `ME-${selected.paymentCode}-${requestId}` : `MP-${selected.paymentCode}-${player}-${suffix}`)
        : (/^[a-f0-9]{32}$/.test(requestId || "") ? `ME-${requestId}` : `DLX-${player}-${Date.now().toString(36)}-${random[0].toString(16).padStart(8, "0")}`);
      if (label.length > 64) throw new Error("label length");
      const returnUrl = new URL(window.location.href);
      returnUrl.search = "";
      returnUrl.searchParams.set("payment", "returned");
      returnUrl.searchParams.set("product", product);
      returnUrl.hash = "return-panel";

      document.getElementById("receiver").value = receiver;
      document.getElementById("sum").value = amount;
      document.getElementById("payment-label").value = label;
      document.getElementById("success-url").value = returnUrl.href;
      form.action = "https://yoomoney.ru/quickpay/confirm";
      form.method = "post";
      form.querySelector('input[name="quickpay-form"]').value = "button";
      try { sessionStorage.setItem(storageKey, JSON.stringify({ player, label, product, createdAt: Date.now() })); }
      catch (_) { /* Хранилище необязательно: номер операции остаётся в ЮMoney. */ }

      submitting = true;
      button.disabled = true;
      buttonLabel.textContent = "Переходим в ЮMoney…";
      message.textContent = "Проверьте сумму и получателя на странице ЮMoney.";
      HTMLFormElement.prototype.submit.call(form);
    } catch (_) {
      restoreButton();
      message.textContent = "Не удалось открыть оплату. Обновите страницу или свяжитесь с поддержкой.";
    }
  });

  // Этот параметр показывает только инструкцию. Он НЕ означает «оплачено».
  if (new URL(window.location.href).searchParams.get("payment") === "returned") {
    const panel = document.getElementById("return-panel");
    panel.hidden = false;
    const pending = readPending();
    if (pending) {
      playerInput.value = pending.player;
      document.getElementById("return-order").textContent = `Товар: ${product} · ID: ${pending.player} · Метка: ${pending.label}`;
    }
    panel.focus({ preventScroll: true });
  }
})();
