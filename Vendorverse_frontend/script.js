
"use strict";

// VendorVerse frontend demo.
// Replace mock data operations with FastAPI requests when the backend is ready.

const API_BASE_URL = "http://localhost:8000/api";
const USE_MOCK_DATA = true;

const vendors = ["TechWorld", "SoundHub", "DeskPlus", "HomeNest", "CarryMate"];

let currentRole = "";
let currentUser = null;
let cart = [];
let selectedProductId = null;
let restockProductId = null;
let adjustProductId = null;
let toastTimer = null;

let products = [
  { id: 1, name: "Wireless Mouse", vendor: "TechWorld", warehouse: "Central Warehouse", price: 799, stock: 25, reorder: 5, icon: "🖱️", description: "A comfortable wireless mouse for everyday work." },
  { id: 2, name: "Mechanical Keyboard", vendor: "TechWorld", warehouse: "Central Warehouse", price: 2499, stock: 4, reorder: 5, icon: "⌨️", description: "A responsive mechanical keyboard for productivity." },
  { id: 3, name: "Bluetooth Headphones", vendor: "SoundHub", warehouse: "North Warehouse", price: 1799, stock: 15, reorder: 5, icon: "🎧", description: "Wireless headphones for music and calls." },
  { id: 4, name: "Laptop Stand", vendor: "DeskPlus", warehouse: "Central Warehouse", price: 999, stock: 3, reorder: 5, icon: "💻", description: "An adjustable stand for a comfortable desk setup." },
  { id: 5, name: "Desk Lamp", vendor: "HomeNest", warehouse: "South Warehouse", price: 649, stock: 12, reorder: 4, icon: "💡", description: "A compact desk lamp for study and work." },
  { id: 6, name: "USB-C Hub", vendor: "TechWorld", warehouse: "Central Warehouse", price: 1299, stock: 0, reorder: 5, icon: "🔌", description: "Expand your laptop connectivity with a USB-C hub." },
  { id: 7, name: "Water Bottle", vendor: "HomeNest", warehouse: "South Warehouse", price: 399, stock: 30, reorder: 8, icon: "🧴", description: "A reusable bottle for daily hydration." },
  { id: 8, name: "Laptop Backpack", vendor: "CarryMate", warehouse: "North Warehouse", price: 1499, stock: 9, reorder: 4, icon: "🎒", description: "A practical backpack for carrying a laptop and accessories." }
];

let orders = [];
let restockRequests = [];
let stockHistory = [
  { date: new Date().toLocaleString(), product: "Mechanical Keyboard", change: "Initial stock: 4", reason: "Demo inventory setup" },
  { date: new Date().toLocaleString(), product: "Laptop Stand", change: "Initial stock: 3", reason: "Demo inventory setup" }
];

let nextOrderId = 1001;
let nextRequestId = 501;
let nextUserId = 1;

const $ = id => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function getProduct(id) {
  return products.find(product => product.id === Number(id));
}

function getVendorProducts(vendor) {
  return products.filter(product => product.vendor === vendor);
}

function getStatus(product) {
  if (product.stock <= 0) return "Out of stock";
  if (product.stock <= product.reorder) return "Low stock";
  return "In stock";
}

function statusBadge(status) {
  let type = "ok";
  if (["Out of stock", "Rejected"].includes(status)) type = "bad";
  if (["Low stock", "Pending", "Approved"].includes(status)) type = "warn";
  return `<span class="badge ${type}">${escapeHTML(status)}</span>`;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

function showPage(pageId) {
  ["rolePage", "loginPage", "customerPage", "vendorPage", "managerPage"]
    .forEach(id => $(id).classList.toggle("hidden", id !== pageId));

  $("logoutBtn").classList.toggle("hidden", pageId === "rolePage" || pageId === "loginPage");
  $("headerInfo").textContent = pageId === "rolePage"
    ? "Smart Inventory & E-Commerce"
    : currentUser ? `Logged in as ${currentUser.name}` : "VendorVerse";
}

function goHome() {
  currentRole = "";
  currentUser = null;
  cart = [];
  $("loginForm").reset();
  $("loginMessage").textContent = "";
  showPage("rolePage");
}

function chooseRole(role) {
  currentRole = role;

  const titles = {
    customer: ["Customer Login", "Sign in to shop and track your orders."],
    vendor: ["Vendor Login", "Select your vendor and open its dashboard."],
    manager: ["Inventory Manager Login", "Sign in to manage all inventory."]
  };

  $("loginTitle").textContent = titles[role][0];
  $("loginDescription").textContent = titles[role][1];
  $("vendorField").classList.toggle("hidden", role !== "vendor");
  $("vendorSelect").required = role === "vendor";
  $("loginName").placeholder = role === "customer"
    ? "Enter your customer name"
    : role === "vendor" ? "Enter your vendor contact name" : "Enter manager name";
  $("loginMessage").textContent = "";
  showPage("loginPage");
}

$("loginForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("loginName").value.trim();
  const password = $("loginPassword").value;

  if (!name || !password) {
    $("loginMessage").textContent = "Enter your name and password.";
    return;
  }

  if (currentRole === "vendor") {
    const vendor = $("vendorSelect").value;
    if (!vendors.includes(vendor)) {
      $("loginMessage").textContent = "Select a valid vendor.";
      return;
    }
    currentUser = { id: nextUserId++, name, role: "vendor", vendor };
    renderVendor();
    showPage("vendorPage");
  } else if (currentRole === "customer") {
    currentUser = { id: nextUserId++, name, role: "customer" };
    $("customerName").textContent = name;
    renderProducts();
    renderCart();
    renderCustomerOrders();
    customerTab("shop");
    showPage("customerPage");
  } else if (currentRole === "manager") {
    currentUser = { id: nextUserId++, name, role: "manager" };
    renderManager();
    showPage("managerPage");
  }
});

function logout() {
  goHome();
}

// ---------- CUSTOMER: SHOP ----------

function renderProducts() {
  const search = ($("productSearch")?.value || "").toLowerCase();

  const filtered = products.filter(product =>
    `${product.name} ${product.vendor} ${product.warehouse}`.toLowerCase().includes(search)
  );

  $("productGrid").innerHTML = filtered.length
    ? filtered.map(product => `
      <article class="product-card">
        <div class="product-visual">${product.icon}</div>
        <p class="muted">${escapeHTML(product.vendor)}</p>
        <h3>${escapeHTML(product.name)}</h3>
        <div class="price">${money(product.price)}</div>
        <p class="stock-label ${product.stock <= 0 ? "stock-out" : product.stock <= product.reorder ? "stock-low" : "stock-ok"}">
          ${product.stock <= 0 ? "Currently unavailable" : `${product.stock} available`}
        </p>
        <button class="btn primary" onclick="openProduct(${product.id})">View Product</button>
      </article>
    `).join("")
    : `<div class="empty-state">No products match your search.</div>`;
}

function openProduct(id) {
  const product = getProduct(id);
  if (!product) return;

  selectedProductId = product.id;
  $("productDetails").innerHTML = `
    <div class="detail-visual">${product.icon}</div>
    <p class="eyebrow">${escapeHTML(product.vendor)}</p>
    <h2>${escapeHTML(product.name)}</h2>
    <p>${escapeHTML(product.description)}</p>
    <p class="muted">Warehouse: ${escapeHTML(product.warehouse)}</p>
    <div class="price">${money(product.price)}</div>
    <p class="stock-label ${product.stock <= 0 ? "stock-out" : product.stock <= product.reorder ? "stock-low" : "stock-ok"}">
      ${product.stock} units available
    </p>
    ${product.stock > 0 ? `
      <label for="detailQuantity">Quantity</label>
      <input id="detailQuantity" type="number" min="1" max="${product.stock}" value="1">
      <div class="modal-actions">
        <button class="btn secondary" onclick="addToCart(${product.id})">Add to Cart</button>
        <button class="btn primary" onclick="orderNow(${product.id})">Order Now</button>
      </div>
    ` : `<p class="muted">This product is out of stock.</p>`}
  `;

  $("productModal").classList.remove("hidden");
}

function addToCart(id, quantityOverride) {
  const product = getProduct(id);
  if (!product) return;

  const quantity = Number(
    quantityOverride ?? $("detailQuantity")?.value ?? 1
  );

  if (!Number.isInteger(quantity) || quantity < 1) {
    showToast("Enter a valid quantity.");
    return;
  }

  const existing = cart.find(item => item.productId === product.id);
  const currentQuantity = existing ? existing.quantity : 0;

  if (currentQuantity + quantity > product.stock) {
    showToast("The requested quantity exceeds available stock.");
    return;
  }

  if (existing) existing.quantity += quantity;
  else cart.push({ productId: product.id, quantity });

  renderCart();
  closeModal("productModal");
  showToast(`${product.name} added to cart.`);
}

function orderNow(id) {
  const product = getProduct(id);
  if (!product) return;

  const quantity = Number($("detailQuantity")?.value || 1);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) {
    showToast("Enter a valid available quantity.");
    return;
  }

  // Order Now intentionally purchases only the selected product.
  cart = [{ productId: product.id, quantity }];
  renderCart();
  closeModal("productModal");
  openCheckout();
}

// ---------- CUSTOMER: CART AND CHECKOUT ----------

function cartTotal() {
  return cart.reduce((total, item) => {
    const product = getProduct(item.productId);
    return total + (product ? product.price * item.quantity : 0);
  }, 0);
}

function renderCart() {
  $("cartCount").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!cart.length) {
    $("cartContents").innerHTML = `<div class="empty-state">Your cart is empty. Browse products to get started.</div>`;
    $("cartSummary").innerHTML = "";
    return;
  }

  $("cartContents").innerHTML = cart.map(item => {
    const product = getProduct(item.productId);
    if (!product) return "";

    return `
      <div class="order-card">
        <div class="order-head">
          <div><strong>${escapeHTML(product.name)}</strong><p class="muted">${money(product.price)} each</p></div>
          <strong>${money(product.price * item.quantity)}</strong>
        </div>
        <div class="action-group">
          <label>Quantity
            <input type="number" min="1" max="${product.stock}" value="${item.quantity}"
              onchange="updateCartQuantity(${product.id}, this.value)">
          </label>
          <button class="btn secondary" onclick="removeFromCart(${product.id})">Remove</button>
        </div>
      </div>
    `;
  }).join("");

  $("cartSummary").innerHTML = `
    <div class="checkout-summary">
      <div class="order-head"><strong>Total</strong><strong>${money(cartTotal())}</strong></div>
      <button class="btn primary full" onclick="openCheckout()">Proceed to Checkout</button>
    </div>
  `;
}

function updateCartQuantity(id, rawValue) {
  const quantity = Number(rawValue);
  const product = getProduct(id);
  const item = cart.find(entry => entry.productId === Number(id));

  if (!item || !product) return;

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) {
    showToast("Choose a quantity within available stock.");
    renderCart();
    return;
  }

  item.quantity = quantity;
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.productId !== Number(id));
  renderCart();
}

function openCheckout() {
  if (!cart.length) {
    showToast("Your cart is empty.");
    return;
  }

  $("checkoutSummary").innerHTML = `
    <div class="order-head"><span>Items</span><strong>${cart.reduce((s, i) => s + i.quantity, 0)}</strong></div>
    <div class="order-head"><span>Total</span><strong>${money(cartTotal())}</strong></div>
  `;
  $("checkoutModal").classList.remove("hidden");
}

$("checkoutForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!currentUser || currentUser.role !== "customer" || !cart.length) return;

  // Validate every item before changing any stock.
  for (const item of cart) {
    const product = getProduct(item.productId);
    if (!product || item.quantity > product.stock) {
      showToast("Stock changed. Review your cart before ordering.");
      renderProducts();
      renderCart();
      return;
    }
  }

  const orderItems = cart.map(item => {
    const product = getProduct(item.productId);
    return {
      productId: product.id,
      name: product.name,
      vendor: product.vendor,
      quantity: item.quantity,
      unitPrice: product.price
    };
  });

  // Demo-only stock deduction. A real backend must do this transactionally.
  for (const item of cart) {
    const product = getProduct(item.productId);
    product.stock -= item.quantity;
    stockHistory.unshift({
      date: new Date().toLocaleString(),
      product: product.name,
      change: `-${item.quantity}`,
      reason: `Customer order`
    });
  }

  const order = {
    id: nextOrderId++,
    customerId: currentUser.id,
    customerName: currentUser.name,
    items: orderItems,
    total: orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    address: $("deliveryAddress").value.trim(),
    payment: $("paymentMethod").value,
    status: "Order Placed",
    date: new Date().toLocaleString()
  };

  orders.unshift(order);
  cart = [];
  $("checkoutForm").reset();
  closeModal("checkoutModal");

  renderProducts();
  renderCart();
  renderCustomerOrders();
  renderVendor();
  renderManager();
  customerTab("orders");

  showToast(`Order #${order.id} placed successfully!`);
});

function customerTab(tab) {
  ["shop", "cart", "orders"].forEach(name => {
    $(`customer${name[0].toUpperCase()}${name.slice(1)}`).classList.toggle("hidden", name !== tab);
  });

  document.querySelectorAll("#customerPage .tab").forEach((button, index) => {
    button.classList.toggle("active", ["shop", "cart", "orders"][index] === tab);
  });

  if (tab === "shop") renderProducts();
  if (tab === "cart") renderCart();
  if (tab === "orders") renderCustomerOrders();
}

function renderCustomerOrders() {
  if (!currentUser || currentUser.role !== "customer") {
    $("customerOrderList").innerHTML = `<div class="empty-state">Log in as a customer to view orders.</div>`;
    return;
  }

  const mine = orders.filter(order => order.customerId === currentUser.id);

  $("customerOrderList").innerHTML = mine.length ? mine.map(order => {
    const stages = ["Order Placed", "Packed", "Shipped", "Delivered"];
    const currentStage = stages.indexOf(order.status);

    return `
      <article class="order-card">
        <div class="order-head">
          <div><strong>Order #${order.id}</strong><p class="muted">${escapeHTML(order.date)}</p></div>
          <div>${statusBadge(order.status)} <strong>${money(order.total)}</strong></div>
        </div>
        <p>${order.items.map(item =>
          `${escapeHTML(item.name)} × ${item.quantity}`
        ).join(", ")}</p>
        <p class="muted">Deliver to: ${escapeHTML(order.address)}</p>
        <div class="tracking">
          ${stages.map((stage, index) => `
            <div class="track-step ${index <= currentStage ? "done" : ""}">
              <div class="track-dot"></div>${stage}
            </div>
          `).join("")}
        </div>
        <p class="muted small">Demo tracking status. Real shipment updates will come from the backend.</p>
      </article>
    `;
  }).join("") : `<div class="empty-state">You haven't placed any orders yet.</div>`;
}

// ---------- VENDOR DASHBOARD ----------

function renderVendor() {
  if (!currentUser || currentUser.role !== "vendor") return;

  const vendor = currentUser.vendor;
  const mine = getVendorProducts(vendor);
  const low = mine.filter(product => product.stock <= product.reorder).length;
  const pending = restockRequests.filter(request =>
    request.vendor === vendor && request.status === "Pending"
  ).length;

  $("vendorHeading").textContent = `${vendor} Dashboard`;
  $("vendorBadge").textContent = vendor;

  $("vendorStats").innerHTML = `
    <div class="stat-card"><p>My Products</p><strong>${mine.length}</strong></div>
    <div class="stat-card"><p>Total Units</p><strong>${mine.reduce((sum, p) => sum + p.stock, 0)}</strong></div>
    <div class="stat-card"><p>Low / Out of Stock</p><strong>${low}</strong></div>
    <div class="stat-card"><p>Pending Requests</p><strong>${pending}</strong></div>
  `;

  const search = ($("vendorSearch").value || "").toLowerCase();
  const filtered = mine.filter(product =>
    `${product.name} ${product.warehouse}`.toLowerCase().includes(search)
  );

  $("vendorInventory").innerHTML = filtered.length ? filtered.map(product => `
    <tr>
      <td><strong>${escapeHTML(product.name)}</strong><br><span class="muted">${money(product.price)}</span></td>
      <td>${escapeHTML(product.warehouse)}</td>
      <td>${product.stock}</td>
      <td>${product.reorder}</td>
      <td>${statusBadge(getStatus(product))}</td>
      <td><button class="btn primary" onclick="openRestock(${product.id})">Request Restock</button></td>
    </tr>
  `).join("") : `<tr><td colspan="6">No products found for this vendor.</td></tr>`;

  const requests = restockRequests.filter(request => request.vendor === vendor);

  $("vendorRequests").innerHTML = requests.length ? requests.map(request => `
    <tr>
      <td>#${request.id}</td>
      <td>${escapeHTML(request.productName)}</td>
      <td>${request.quantity}</td>
      <td>${escapeHTML(request.date)}</td>
      <td>${statusBadge(request.status)}</td>
    </tr>
  `).join("") : `<tr><td colspan="5">No restock requests yet.</td></tr>`;

  const vendorOrders = orders.filter(order =>
    order.items.some(item => item.vendor === vendor)
  );

  $("vendorOrders").innerHTML = vendorOrders.length ? vendorOrders.map(order => {
    const relevantItems = order.items.filter(item => item.vendor === vendor);
    return `
      <article class="order-card">
        <div class="order-head"><strong>Order #${order.id}</strong>${statusBadge(order.status)}</div>
        <p>Customer: ${escapeHTML(order.customerName)}</p>
        <p>${relevantItems.map(item => `${escapeHTML(item.name)} × ${item.quantity}`).join(", ")}</p>
        <p class="muted">Order date: ${escapeHTML(order.date)}</p>
      </article>
    `;
  }).join("") : `<div class="empty-state">No orders for your products yet.</div>`;
}

function openRestock(id) {
  const product = getProduct(id);
  if (!product || !currentUser || currentUser.role !== "vendor") return;
  if (product.vendor !== currentUser.vendor) {
    showToast("You can only request stock for your own products.");
    return;
  }

  restockProductId = product.id;
  $("restockProductName").textContent = `${product.name} · Current stock: ${product.stock}`;
  $("restockQuantity").value = Math.max(1, product.reorder * 2 - product.stock);
  $("restockNote").value = "";
  $("restockModal").classList.remove("hidden");
}

$("restockForm").addEventListener("submit", event => {
  event.preventDefault();

  const product = getProduct(restockProductId);
  const quantity = Number($("restockQuantity").value);

  if (!product || !currentUser || currentUser.role !== "vendor") return;
  if (product.vendor !== currentUser.vendor) return;

  if (!Number.isInteger(quantity) || quantity < 1) {
    showToast("Enter a valid restock quantity.");
    return;
  }

  restockRequests.unshift({
    id: nextRequestId++,
    productId: product.id,
    productName: product.name,
    vendor: product.vendor,
    warehouse: product.warehouse,
    quantity,
    note: $("restockNote").value.trim(),
    date: new Date().toLocaleString(),
    status: "Pending",
    receivedQuantity: 0
  });

  closeModal("restockModal");
  renderVendor();
  renderManager();
  showToast("Restock request submitted for manager approval.");
});

// ---------- INVENTORY MANAGER ----------

function renderManager() {
  const search = ($("managerSearch").value || "").toLowerCase();
  const filter = $("managerStockFilter").value;

  const lowCount = products.filter(product => product.stock <= product.reorder).length;
  const pendingCount = restockRequests.filter(request => request.status === "Pending").length;
  const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);

  $("managerStats").innerHTML = `
    <div class="stat-card"><p>Total Products</p><strong>${products.length}</strong></div>
    <div class="stat-card"><p>Total Stock Units</p><strong>${totalUnits}</strong></div>
    <div class="stat-card"><p>Low / Out of Stock</p><strong>${lowCount}</strong></div>
    <div class="stat-card"><p>Pending Restock Requests</p><strong>${pendingCount}</strong></div>
  `;

  const filtered = products.filter(product => {
    const matchesSearch = `${product.name} ${product.vendor} ${product.warehouse}`
      .toLowerCase().includes(search);

    const matchesFilter =
      filter === "All" ||
      (filter === "Out" && product.stock <= 0) ||
      (filter === "Low" && product.stock > 0 && product.stock <= product.reorder) ||
      (filter === "Healthy" && product.stock > product.reorder);

    return matchesSearch && matchesFilter;
  });

  $("managerInventory").innerHTML = filtered.length ? filtered.map(product => `
    <tr>
      <td><strong>${escapeHTML(product.name)}</strong><br><span class="muted">${money(product.price)}</span></td>
      <td>${escapeHTML(product.vendor)}</td>
      <td>${escapeHTML(product.warehouse)}</td>
      <td>${product.stock}</td>
      <td>${product.reorder}</td>
      <td>${statusBadge(getStatus(product))}</td>
      <td><button class="btn secondary" onclick="openAdjust(${product.id})">Adjust Stock</button></td>
    </tr>
  `).join("") : `<tr><td colspan="7">No inventory items match your filter.</td></tr>`;

  $("managerRequests").innerHTML = restockRequests.length ? restockRequests.map(request => {
    let actions = "";

    if (request.status === "Pending") {
      actions = `
        <div class="action-group">
          <button class="btn success" onclick="approveRequest(${request.id})">Approve</button>
          <button class="btn danger" onclick="rejectRequest(${request.id})">Reject</button>
        </div>
      `;
    } else if (request.status === "Approved") {
      actions = `<button class="btn primary" onclick="receiveRequest(${request.id})">Record Receipt</button>`;
    } else {
      actions = `<span class="muted small">No action</span>`;
    }

    return `
      <tr>
        <td>#${request.id}</td>
        <td>${escapeHTML(request.vendor)}</td>
        <td>${escapeHTML(request.productName)}</td>
        <td>${request.quantity}</td>
        <td>${statusBadge(request.status)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6">No restock requests submitted.</td></tr>`;

  $("stockHistory").innerHTML = stockHistory.length ? stockHistory.slice(0, 100).map(entry => `
    <tr>
      <td>${escapeHTML(entry.date)}</td>
      <td>${escapeHTML(entry.product)}</td>
      <td>${escapeHTML(entry.change)}</td>
      <td>${escapeHTML(entry.reason)}</td>
    </tr>
  `).join("") : `<tr><td colspan="4">No stock movements recorded.</td></tr>`;
}

function approveRequest(id) {
  if (!currentUser || currentUser.role !== "manager") return;

  const request = restockRequests.find(item => item.id === Number(id));
  if (!request || request.status !== "Pending") return;

  request.status = "Approved";
  request.approvedDate = new Date().toLocaleString();

  renderManager();
  renderVendor();
  showToast("Request approved. Stock has not increased yet.");
}

function rejectRequest(id) {
  if (!currentUser || currentUser.role !== "manager") return;

  const request = restockRequests.find(item => item.id === Number(id));
  if (!request || request.status !== "Pending") return;

  request.status = "Rejected";
  renderManager();
  renderVendor();
  showToast("Restock request rejected.");
}

function receiveRequest(id) {
  if (!currentUser || currentUser.role !== "manager") return;

  const request = restockRequests.find(item => item.id === Number(id));
  if (!request || request.status !== "Approved") return;

  const product = getProduct(request.productId);
  if (!product) return;

  const raw = prompt(
    `Enter the actual quantity received for ${product.name}.\nRequested: ${request.quantity}`,
    String(request.quantity)
  );

  if (raw === null) return;

  const received = Number(raw);

  if (!Number.isInteger(received) || received < 1 || received > request.quantity) {
    showToast("Enter a whole number between 1 and the requested quantity.");
    return;
  }

  product.stock += received;
  request.receivedQuantity = received;
  request.status = "Received";
  request.receivedDate = new Date().toLocaleString();

  stockHistory.unshift({
    date: new Date().toLocaleString(),
    product: product.name,
    change: `+${received}`,
    reason: `Goods received for restock request #${request.id}`
  });

  renderManager();
  renderVendor();
  renderProducts();
  showToast(`${received} units of ${product.name} received and added to stock.`);
}

function openAdjust(id) {
  if (!currentUser || currentUser.role !== "manager") return;

  const product = getProduct(id);
  if (!product) return;

  adjustProductId = product.id;
  $("adjustProductName").textContent = `${product.name} · Current stock: ${product.stock}`;
  $("adjustQuantity").value = "";
  $("adjustReason").value = "";
  $("adjustModal").classList.remove("hidden");
}

$("adjustForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!currentUser || currentUser.role !== "manager") return;

  const product = getProduct(adjustProductId);
  const quantity = Number($("adjustQuantity").value);
  const reason = $("adjustReason").value.trim();

  if (!product || !Number.isInteger(quantity) || quantity === 0 || !reason) {
    showToast("Enter a non-zero whole number and a reason.");
    return;
  }

  if (product.stock + quantity < 0) {
    showToast("Stock cannot become negative.");
    return;
  }

  product.stock += quantity;
  stockHistory.unshift({
    date: new Date().toLocaleString(),
    product: product.name,
    change: quantity > 0 ? `+${quantity}` : String(quantity),
    reason
  });

  closeModal("adjustModal");
  renderManager();
  renderVendor();
  renderProducts();
  showToast("Stock adjustment saved.");
});

// ---------- MODALS AND STARTUP ----------

function closeModal(id) {
  $(id).classList.add("hidden");
}

function closeModalOutside(event, id) {
  if (event.target.id === id) closeModal(id);
}

function apiRequest(path, options = {}) {
  // Future integration point for FastAPI. Do not call until the backend exists.
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  }).then(async response => {
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  });
}

// Render the initial shop and manager tables without requiring a login.
renderProducts();
renderCart();
renderManager();
goHome();
