/* Простая локальная сверка настроек. Не является банковской проверкой или авторизацией. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MyEngineDeveloper = api;
})(globalThis, function () {
  "use strict";
  const idPattern = /^[A-Za-z0-9_.-]{1,32}$/;
  function playerId(value) {
    const id = String(value || "").trim();
    if (!idPattern.test(id)) throw new Error("ID: от 1 до 32 латинских букв, цифр или символов . _ -");
    return id;
  }
  function cardSuffix(value) {
    const suffix = String(value || "").trim();
    if (!/^\d{4}$/.test(suffix)) throw new Error("Введите только последние 4 цифры карты.");
    return suffix;
  }
  function phoneDigits(value) {
    const raw = String(value || "").trim();
    if (!/^\+?[\d\s().-]+$/.test(raw)) throw new Error("Введите телефон с кодом страны, например +7… или +371…");
    let phone = raw.replace(/\D/g, "");
    if (phone.length === 11 && phone.startsWith("8")) phone = "7" + phone.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(phone)) throw new Error("Проверьте телефон: нужны код страны и от 8 до 15 цифр.");
    return phone;
  }
  function cryptoApi() {
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues)
      throw new Error("Недоступна локальная проверка. Откройте страницу в современном браузере через HTTPS или как локальный файл.");
    return globalThis.crypto;
  }
  function randomHex(bytes) {
    const data = new Uint8Array(bytes);
    cryptoApi().getRandomValues(data);
    return Array.from(data, n => n.toString(16).padStart(2, "0")).join("");
  }
  async function fingerprint(salt, id, last4, phone) {
    if (!/^[a-f0-9]{32}$/.test(salt)) throw new Error("Некорректная настройка режима разработчика.");
    const data = ["myengine-developer-v1", salt, playerId(id), cardSuffix(last4), phoneDigits(phone)].join("\n");
    const digest = await cryptoApi().subtle.digest("SHA-256", new TextEncoder().encode(data));
    return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
  }
  function isConfigured(config) {
    return !!config && config.enabled === true && typeof config.playerId === "string" &&
      idPattern.test(config.playerId) && typeof config.salt === "string" && /^[a-f0-9]{32}$/.test(config.salt) &&
      typeof config.fingerprintSha256 === "string" && /^[a-f0-9]{64}$/.test(config.fingerprintSha256);
  }
  async function createSettings(id, last4, phone) {
    id = playerId(id); last4 = cardSuffix(last4); phone = phoneDigits(phone);
    const salt = randomHex(16);
    return { enabled: true, playerId: id, salt, fingerprintSha256: await fingerprint(salt, id, last4, phone) };
  }
  async function matches(config, id, last4, phone) {
    if (!isConfigured(config)) return false;
    id = playerId(id);
    if (id !== config.playerId) return false;
    return await fingerprint(config.salt, id, last4, phone) === config.fingerprintSha256;
  }
  async function issue(config, id, last4, phone, product = {}) {
    if (!await matches(config, id, last4, phone)) throw new Error("Данные не совпадают с настройками разработчика.");
    return {
      schema: "myengine-license/v1",
      certificateId: "DEV-" + randomHex(16),
      product: product.gameName || "MyEngine",
      productId: product.productId || "deluxe",
      edition: product.productTitle || "Deluxe",
      playerId: playerId(id),
      issuedAt: new Date().toISOString(),
      grantType: "developer",
      licenseStatus: "issued",
      payment: { status: "not_required", amount: 0, currency: "RUB" },
      verification: { method: "local_configuration_match", bankVerified: false, serverVerified: false },
      signature: null
    };
  }
  return Object.freeze({ playerId, cardSuffix, phoneDigits, isConfigured, createSettings, matches, issue });
});
