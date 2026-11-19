const REQUIRED_TAPS = 5;
const TAP_WINDOW_MS = 2000;

let products = JSON.parse(localStorage.getItem("khairat_products")) || initialDB.products;
let logs = JSON.parse(localStorage.getItem("khairat_logs")) || [];
let selectedMood = "";
let html5QrCode = null;
let isAdminUnlocked = false;
let tapCount = 0;
let tapTimer = null;

function saveProducts() {
  localStorage.setItem("khairat_products", JSON.stringify(products));
}

function saveLogs() {
  localStorage.setItem("khairat_logs", JSON.stringify(logs));
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2600);
}

function handleSecretTitleTap() {
  const admin = document.getElementById("adminView");
  if (!admin.classList.contains("hidden")) {
    exitAdminView();
    return;
  }

  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => {
    tapCount = 0;
  }, TAP_WINDOW_MS);

  if (tapCount >= REQUIRED_TAPS) {
    tapCount = 0;
    clearTimeout(tapTimer);
    if (isAdminUnlocked) {
      openAdminView();
    } else {
      openPinModal();
    }
  }
}

function switchTab(tabName, btn) {
  stopScanner();
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  ["scan", "rate", "request"].forEach((id) => {
    document.getElementById("tab-" + id).classList.toggle("hidden", id !== tabName);
  });
}

function startScanner() {
  const readerEl = document.getElementById("reader");
  readerEl.style.display = "block";
  document.getElementById("startScanBtn").classList.add("hidden");
  document.getElementById("stopScanBtn").classList.remove("hidden");

  html5QrCode = new Html5Qrcode("reader");
  html5QrCode
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 140 } },
      (decodedText) => {
        document.getElementById("barcodeInput").value = decodedText;
        stopScanner();
        searchProduct();
      }
    )
    .catch(() => {
      showToast("تعذر فتح الكاميرا، استخدم الإدخال اليدوي أو السريع");
      stopScanner();
    });
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
  document.getElementById("reader").style.display = "none";
  document.getElementById("startScanBtn").classList.remove("hidden");
  document.getElementById("stopScanBtn").classList.add("hidden");
}

function quickTest(code) {
  document.getElementById("barcodeInput").value = code;
  searchProduct();
}

function searchProduct() {
  const code = document.getElementById("barcodeInput").value.trim();
  const box = document.getElementById("resultBox");
  if (!code) return showToast("أدخل رقم الباركود أولاً");

  box.style.display = "block";
  const item = products[code];
  if (item) {
    box.classList.remove("not-found");
    const stockLabel = Number(item.stock) > 0 ? `متوفر (${item.stock} وحدة)` : "غير متوفر حالياً";
    box.innerHTML = `
      <span class="badge">${item.category || "عام"}</span>
      <div class="product-name">${item.name}</div>
      <div style="font-size:0.82rem; color:var(--muted);">باركود: ${code} • ${stockLabel}</div>
      <div class="product-price">${Number(item.price).toLocaleString()} د.ع</div>
      <div style="font-size:0.85rem; margin-top:8px;">رأيك بالسعر؟</div>
      <div class="price-vote">
        <button class="vote-btn good" onclick="votePrice('${item.name}', 'سعر مناسب 👍')">👍 مناسب</button>
        <button class="vote-btn high" onclick="votePrice('${item.name}', 'سعر مرتفع 👎')">👎 مرتفع</button>
      </div>
    `;
  } else {
    box.classList.add("not-found");
    box.innerHTML = `
      <div class="product-name" style="color:var(--danger);">المنتج غير مسجل حالياً</div>
      <div style="font-size:0.9rem;">باركود: ${code} — يرجى مراجعة الكاشير للتأكد من السعر.</div>
    `;
  }
}

function votePrice(productName, verdict) {
  logs.unshift({
    type: "تقييم سعر",
    detail: `${productName}: ${verdict}`,
    time: new Date().toLocaleTimeString("ar-IQ")
  });
  saveLogs();
  showToast("شكراً لمشاركتك رأيك بالسعر!");
}

function selectMood(mood, el) {
  selectedMood = mood;
  document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"));
  el.classList.add("selected");
}

function submitFeedback() {
  const text = document.getElementById("feedbackText").value.trim();
  if (!selectedMood && !text) return showToast("اختر تقييم أو اكتب ملاحظة");
  logs.unshift({
    type: "تقييم وشكوى",
    detail: `${selectedMood || "بدون تحديد"} ${text ? "- " + text : ""}`,
    time: new Date().toLocaleTimeString("ar-IQ")
  });
  saveLogs();
  document.getElementById("feedbackText").value = "";
  selectedMood = "";
  document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"));
  showToast("تم إرسال تقييمك بنجاح!");
}

function submitRequest() {
  const name = document.getElementById("reqProductName").value.trim();
  const notes = document.getElementById("reqNotes").value.trim();
  if (!name) return showToast("اكتب اسم المنتج المطلوب");
  logs.unshift({
    type: "طلب منتج",
    detail: `${name} ${notes ? "(" + notes + ")" : ""}`,
    time: new Date().toLocaleTimeString("ar-IQ")
  });
  saveLogs();
  document.getElementById("reqProductName").value = "";
  document.getElementById("reqNotes").value = "";
  showToast("تم تسجيل طلبك بنجاح!");
}

function openPinModal() {
  stopScanner();
  document.getElementById("pinInput").value = "";
  document.getElementById("pinModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("pinInput").focus(), 100);
}

function closePinModal() {
  document.getElementById("pinModal").classList.add("hidden");
}

function verifyPin() {
  const entered = document.getElementById("pinInput").value.trim();
  if (entered === ADMIN_PIN) {
    isAdminUnlocked = true;
    closePinModal();
    openAdminView();
    showToast("تم فتح لوحة الإدارة بنجاح ✅");
  } else {
    showToast("الرقم السري غير صحيح ❌");
    document.getElementById("pinInput").value = "";
  }
}

function openAdminView() {
  document.getElementById("adminView").classList.remove("hidden");
  document.getElementById("customerView").classList.add("hidden");
  renderAdmin();
}

function exitAdminView() {
  document.getElementById("adminView").classList.add("hidden");
  document.getElementById("customerView").classList.remove("hidden");
}

function lockAdmin() {
  isAdminUnlocked = false;
  exitAdminView();
  showToast("تم قفل لوحة الإدارة 🔒");
}

function renderAdmin() {
  const tbody = document.getElementById("productsTable");
  tbody.innerHTML = Object.values(products)
    .map(
      (p) => `
      <tr>
        <td>${p.barcode}</td>
        <td>${p.name}</td>
        <td>${p.category || "عام"}</td>
        <td>${Number(p.price).toLocaleString()}</td>
        <td><button onclick="deleteProduct('${p.barcode}')" style="color:red;border:none;background:none;cursor:pointer;">✖</button></td>
      </tr>
    `
    )
    .join("");

  const logsEl = document.getElementById("logsList");
  logsEl.innerHTML = logs.length
    ? logs
        .map(
          (l) =>
            `<div style="padding:8px 0; border-bottom:1px solid #f1f5f9;"><b>[${l.type}]</b> ${l.detail} <span style="color:var(--muted);font-size:0.75rem;">(${l.time})</span></div>`
        )
        .join("")
    : "<p style='color:var(--muted);'>لا توجد تقييمات أو طلبات بعد.</p>";
}

function addProduct() {
  const barcode = document.getElementById("newCode").value.trim();
  const name = document.getElementById("newName").value.trim();
  const category = document.getElementById("newCategory").value.trim() || "عام";
  const price = document.getElementById("newPrice").value.trim();
  const stock = Number(document.getElementById("newStock").value.trim() || 0);
  if (!barcode || !name || !price) return showToast("املأ الباركود والاسم والسعر");
  products[barcode] = { barcode, name, category, price: Number(price), stock };
  saveProducts();
  ["newCode", "newName", "newCategory", "newPrice", "newStock"].forEach((id) => (document.getElementById(id).value = ""));
  renderAdmin();
  showToast("تم حفظ المنتج!");
}

function deleteProduct(barcode) {
  delete products[barcode];
  saveProducts();
  renderAdmin();
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split(/\r?\n/).filter(Boolean);
    let count = 0;
    lines.forEach((line, idx) => {
      const cols = line.split(",");
      if (idx === 0 && cols[0].trim().toLowerCase() === "barcode") return;
      const [barcode, name, category, price, stock] = cols;
      if (barcode && name && !isNaN(Number(price))) {
        const code = barcode.trim();
        products[code] = {
          barcode: code,
          name: name.trim(),
          category: (category || "عام").trim(),
          price: Number(price.trim()),
          stock: Number((stock || 0).toString().trim()) || 0
        };
        count++;
      }
    });
    saveProducts();
    renderAdmin();
    showToast(`تم استيراد ${count} منتج بنجاح!`);
  };
  reader.readAsText(file);
}

function exportJSON() {
  const payload = JSON.stringify({ market_name: "ماركت خيرات الرحمن", currency: "IQD", products, logs }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "market_database.json";
  a.click();
  URL.revokeObjectURL(url);
}

function clearLogs() {
  logs = [];
  saveLogs();
  renderAdmin();
}