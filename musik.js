/* Musik hanya boleh mulai SETELAH klik Buka Undangan (#btn_open).
 * Menahan panggilan otomatis window.playAudio() (mis. saat tab dibuka kembali)
 * sebelum undangan dibuka. Klik Buka Undangan tetap memutar lagu seperti biasa.
 */
(function () {
  var opened = false;
  // Capture di document = jalan SEBELUM handler lain, jadi flag siap saat lagu diputar.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest("#btn_open")) opened = true;
  }, true);
  function guard() {
    if (window.playAudio && !window.playAudio.__amsGuarded) {
      var orig = window.playAudio;
      var wrapped = function () {
        if (!opened) return undefined;
        return orig.apply(this, arguments);
      };
      wrapped.__amsGuarded = true;
      window.playAudio = wrapped;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", guard);
  else guard();
})();
