/* Personalisasi nama tamu dari link: .../#to=Nama+Tamu (atau ?to=...)
 * Contoh: https://kirimdigi.github.io/Zidan-Popi/#to=Syafiq%20%26%20Yudela
 * -> tulisan "Tamu Undangan" (cover + bagian QR) otomatis jadi "Syafiq & Yudela"
 * -> kolom Nama di form ucapan ikut terisi otomatis.
 */
(function () {
  function getGuestName() {
    var m = null;
    if (location.hash) {
      m = location.hash.match(/[?#&]to=([^&]*)/);
    }
    if (!m && location.search) {
      m = location.search.match(/[?&]to=([^&]*)/);
    }
    if (!m || !m[1]) return "";
    try {
      return decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    } catch (e) {
      return "";
    }
  }
  function apply() {
    var nama = getGuestName();
    if (!nama) return;
    // textContent = otomatis aman dari HTML injection
    document.querySelectorAll(
      '[data-id="d97ae05"] .elementor-heading-title, [data-id="a10a974"] .elementor-heading-title'
    ).forEach(function (el) {
      el.textContent = nama;
    });
    var author = document.querySelector('#commentform-6854 input[name="author"]');
    if (author && !author.value) author.value = nama;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
  window.addEventListener("hashchange", apply);
})();
