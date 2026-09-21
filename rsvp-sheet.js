/* RSVP Ucapan -> Spreadsheet (Google Apps Script) + tampil instan + tanggal/jam
 * Cara pakai:
 * 1. Buat Google Sheet + Apps Script (kode ada di panduan), Deploy as Web App (Anyone).
 * 2. Tempel URL-nya ke RSVP_SHEET_URL di bawah, contoh:
 *    const RSVP_SHEET_URL = "https://script.google.com/macros/s/XXXX/exec";
 * 3. Refresh halaman. Tanpa URL pun ucapan tetap tampil instan (tersimpan di browser).
 */
const RSVP_SHEET_URL = "https://script.google.com/macros/s/AKfycbwc6sK471ZXPZixki-VdWFtTd-X_Rhx47Gx6JPIAjKMa9_xCf8S33cPUeoA7wWPoF8Q4Q/exec";
const RSVP_POST_ID = "6854";
const RSVP_STORAGE_KEY = "wishes_6854_v1";
var lastSendKey = "", lastSendAt = 0;
var listOpen = false, ucapanCount = 0;

(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmtTanggal(iso) {
    try {
      var d = new Date(iso);
      var s = d.toLocaleString("id-ID", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
      return s.replace(".", ":") + " WIB";
    } catch (e) { return ""; }
  }
  function badge(att) {
    if (att === "present") return '<span class="wds-badge wds-hadir">Hadir</span>';
    if (att === "notpresent") return '<span class="wds-badge wds-tidak">Tidak Hadir</span>';
    return "";
  }

  // CSS ucapan
  var css = document.createElement("style");
  css.textContent = [
    "#saic-wrap-comment-6854{display:block !important;}",
    "#saic-container-comment-6854{display:none;list-style:none;margin:18px 0 0;padding:0 4px 0 0;max-height:380px;overflow-y:auto;scrollbar-width:thin;}",
    "#saic-container-comment-6854.wds-open{display:block;}",
    "#wds-toggle-ucapan{width:100%;margin-top:12px;padding:10px 14px;border-radius:999px;border:1px solid #B09B7B;background:transparent;color:#8a7a63;font-weight:700;font-size:14px;cursor:pointer;}",
    "#wds-toggle-ucapan:hover{background:#B09B7B;color:#fff;}",
    ".wds-ucapan-item{background:#fff;border:1px solid #eadfd2;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.05);text-align:left;}",
    ".wds-ucapan-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;}",
    ".wds-ucapan-nama{font-weight:700;color:#5b4a3a;font-size:14px;}",
    ".wds-badge{font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;}",
    ".wds-hadir{background:#e7f6ec;color:#1c7c3e;}",
    ".wds-tidak{background:#fdecea;color:#b3261e;}",
    ".wds-ucapan-waktu{font-size:11px;color:#a08c78;margin-left:auto;}",
    ".wds-ucapan-isi{font-size:14px;color:#333;line-height:1.5;word-wrap:break-word;}",
    ".wds-ucapan-tamu{font-size:11px;color:#a08c78;font-weight:700;white-space:nowrap;}",
    ".saic-ajax-success{background:#e7f6ec;color:#1c7c3e;padding:10px 12px;border-radius:8px;font-size:14px;}",
    ".saic-ajax-error{background:#fdecea;color:#b3261e;padding:10px 12px;border-radius:8px;font-size:14px;}",
    ".wds-loading{font-size:13px;color:#a08c78;padding:8px 0;}",
    "#guest{text-align:left !important;text-align-last:left !important;padding:8px 32px 8px 14px !important;box-sizing:border-box !important;}",
    ".saic-wrap-guest select{min-width:0 !important;}"
  ].join("\n");
  document.head.appendChild(css);

  function getList() {
    try { return JSON.parse(localStorage.getItem(RSVP_STORAGE_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function setList(a) {
    try { localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(dedupe(a).slice(0, 200))); } catch (e) {}
  }
  // Hapus ganda: nama+ucapan sama & waktu berdekatan (<10 mnt) dianggap 1 ucapan.
  // (Waktu dari spreadsheet kehilangan milidetik, jadi timestamp persis tak bisa disamakan.)
  function sameUcapan(a, b) {
    if (!a || !b) return false;
    if (String(a.nama || "").trim() !== String(b.nama || "").trim()) return false;
    if (String(a.ucapan || "").trim() !== String(b.ucapan || "").trim()) return false;
    var ta = Date.parse(a.timestamp), tb = Date.parse(b.timestamp);
    if (isNaN(ta) || isNaN(tb)) return true;
    return Math.abs(ta - tb) < 10 * 60 * 1000;
  }
  function dedupe(items) {
    var out = [];
    (items || []).forEach(function (it) {
      var dup = out.some(function (kept) { return sameUcapan(kept, it); });
      if (!dup) out.push(it);
    });
    return out;
  }
  function render(items) {
    var ul = $("#saic-container-comment-" + RSVP_POST_ID);
    if (!ul) return;
    items = dedupe(items);
    if (!items.length) {
      ul.innerHTML = '<li class="wds-loading">Belum ada ucapan. Jadilah yang pertama mengirim doa terbaik.</li>';
      return;
    }
    ul.innerHTML = items.map(function (it) {
      var tamuTxt = "";
      if (it.kehadiran === "present" && parseInt(it.tamu, 10) > 0) {
        tamuTxt = '<span class="wds-ucapan-tamu">' + esc(it.tamu) + " orang</span>";
      }
      return '<li class="wds-ucapan-item">' +
        '<div class="wds-ucapan-head"><span class="wds-ucapan-nama">' + esc(it.nama) + "</span>" +
        badge(it.kehadiran) + tamuTxt +
        '<span class="wds-ucapan-waktu">' + esc(fmtTanggal(it.timestamp)) + "</span></div>" +
        '<div class="wds-ucapan-isi">' + esc(it.ucapan) + "</div></li>";
    }).join("");
    var link = $("#saic-link-" + RSVP_POST_ID + " span");
    if (link) link.textContent = String(items.length);
    ucapanCount = items.length;
    updateToggle();
  }
  function updateToggle() {
    var b = $("#wds-toggle-ucapan");
    if (!b) return;
    b.textContent = (listOpen ? "Sembunyikan Ucapan (" : "Tampilkan Ucapan (") + ucapanCount + ")";
  }

  function showStatus(html, isOk) {
    var st = $("#saic-comment-status-" + RSVP_POST_ID);
    if (!st) return;
    st.innerHTML = '<p class="' + (isOk ? "saic-ajax-success" : "saic-ajax-error") + '">' + html + "</p>";
    st.style.display = "block";
    setTimeout(function () { st.style.display = "none"; }, 4000);
  }

  async function loadRemote() {
    if (!RSVP_SHEET_URL) return null;
    try {
      var r = await fetch(RSVP_SHEET_URL + "?action=list", { method: "GET" });
      var j = await r.json();
      if (j && j.ok && Array.isArray(j.data)) return j.data;
    } catch (e) {}
    return null;
  }
  async function sendRemote(item) {
    if (!RSVP_SHEET_URL) return;
    try {
      await fetch(RSVP_SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          nama: item.nama, ucapan: item.ucapan,
          kehadiran: item.kehadiran, tamu: item.tamu,
          timestamp: item.timestamp
        })
      });
    } catch (e) {}
  }

  function init() {
    // Matikan handler bawaan wds-rsvp.js (ajax ke WordPress lama yang sudah mati)
    try {
      if (window.jQuery) jQuery("body").off("submit", ".saic-container-form form");
    } catch (e) {}
    // Paksa tampil (sistem lama menyembunyikan + gagal ajax ke WordPress)
    var wrap = $("#saic-wrap-comment-" + RSVP_POST_ID);
    if (wrap) wrap.style.display = "block";

    // Tombol Tampilkan/Sembunyikan Ucapan di bawah tombol Kirim
    var formEl = $("#commentform-" + RSVP_POST_ID);
    if (formEl && !$("#wds-toggle-ucapan")) {
      var tg = document.createElement("button");
      tg.type = "button";
      tg.id = "wds-toggle-ucapan";
      var anchor = formEl.querySelector(".saic-wrap-submit");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(tg, anchor.nextSibling);
      else formEl.appendChild(tg);
      tg.addEventListener("click", function () {
        listOpen = !listOpen;
        var ul = $("#saic-container-comment-" + RSVP_POST_ID);
        if (ul) ul.classList.toggle("wds-open", listOpen);
        updateToggle();
      });
      updateToggle();
    }

    var local = getList();
    render(local);
    loadRemote().then(function (remote) {
      if (remote && remote.length) {
        // Gabung: remote + lokal yang belum ada di remote (perbandingan longgar via dedupe)
        var merged = dedupe(remote.concat(local));
        setList(merged);
        render(merged);
      }
    });

    // Cegat submit SEBELUM script bawaan (capture + stopImmediatePropagation)
    document.addEventListener("submit", function (e) {
      var f = e.target;
      if (!f || !f.id || f.id !== "commentform-" + RSVP_POST_ID) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.stopPropagation) e.stopPropagation();

      var namaEl = f.querySelector('input[name="author"]');
      var ucapEl = f.querySelector('textarea[name="comment"]');
      var attEl = f.querySelector('input[name="attendance"]');
      var guestEl = f.querySelector('select[name="guest"]');
      var nama = (namaEl ? namaEl.value : "").trim().replace(/\s+/g, " ");
      var ucapan = (ucapEl ? ucapEl.value : "").trim();
      var kehadiran = attEl ? attEl.value : "notsure";
      var tamu = guestEl ? guestEl.value : "1";

      if (nama.length < 2) {
        var ne = f.querySelector(".saic-error-info-name");
        if (ne) { ne.style.display = "inline"; setTimeout(function(){ ne.style.display="none"; }, 2500); }
        showStatus("Isi nama dulu ya (minimal 2 huruf).", false);
        if (namaEl) namaEl.focus();
        return;
      }
      if (ucapan.replace(/\s+/g, " ").length < 2) {
        var te = f.querySelector(".saic-error-info-text");
        if (te) { te.style.display = "inline"; setTimeout(function(){ te.style.display="none"; }, 2500); }
        showStatus("Tulis ucapan dulu ya (minimal 2 karakter).", false);
        if (ucapEl) ucapEl.focus();
        return;
      }
      if (kehadiran !== "present" && kehadiran !== "notpresent") {
        var ae = f.querySelector(".saic-error-info-attendance");
        if (ae) { ae.style.display = "inline"; setTimeout(function(){ ae.style.display="none"; }, 2500); }
        showStatus("Pilih konfirmasi kehadiran (Hadir / Tidak Hadir) dulu ya.", false);
        return;
      }

      var btn = f.querySelector('input[type="submit"]');
      if (btn) { btn.disabled = true; btn.value = "Mengirim..."; }

      // Kunci klik-ganda: abaikan kirim ulang konten sama dalam 3 detik
      var now = Date.now();
      var sendKey = nama + "|" + ucapan;
      if (sendKey === lastSendKey && (now - lastSendAt) < 3000) {
        if (btn) { btn.disabled = false; btn.value = "Kirim"; }
        return;
      }
      lastSendKey = sendKey; lastSendAt = now;

      var item = {
        nama: nama, ucapan: ucapan, kehadiran: kehadiran, tamu: tamu,
        timestamp: new Date().toISOString()
      };
      var list = getList();
      list.unshift(item);
      setList(list);
      render(list);
      sendRemote(item);

      showStatus("Terimakasih atas ucapan Anda! Ucapanmu sudah tampil di bawah.", true);
      listOpen = true;
      var ulOpen = $("#saic-container-comment-" + RSVP_POST_ID);
      if (ulOpen) ulOpen.classList.add("wds-open");
      updateToggle();
      if (ucapEl) ucapEl.value = "";
      if (btn) { btn.disabled = false; btn.value = "Kirim"; }
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
