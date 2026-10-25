
/* ROYAL FITS BOUTIQUE254 - STAFF DASHBOARD */

const SUPABASE_URL =
  "https://rutpxicmpjdqvrfoicnv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_iUUvMivOvVBbk4XvCCDWtQ_iOWSra5g";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

let currentRole = null;
let orders = [];
let orderItemNames = {};
let orderItemsByOrder = {};

window.addEventListener("error", function (event) {
  const message = $("loginMessage");
  if (message) {
    message.textContent = "JavaScript error: " + event.message;
  }
});

window.addEventListener("unhandledrejection", function (event) {
  const message = $("loginMessage");
  if (message) {
    message.textContent =
      "Error: " +
      (event.reason?.message || String(event.reason));
  }
});

function showMessage(elementId, message) {
  const element = $(elementId);
  if (element) element.textContent = message;
}

function safeText(value) {
  return value == null ? "" : String(value);
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return safeText(value);

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(amount);
}

function statusClass(value) {
  const status = safeText(value).toLowerCase();

  if (["paid", "successful", "delivered"].includes(status)) {
    return "paid";
  }

  if (["failed", "cancelled", "canceled"].includes(status)) {
    return "failed";
  }

  if (
    ["unpaid", "pending", "processing", "shipped"].includes(status)
  ) {
    return "pending";
  }

  return "";
}

function makeCell(value) {
  const td = document.createElement("td");
  td.textContent = safeText(value);
  return td;
}

function makeStatus(value) {
  const span = document.createElement("span");
  span.className = "status " + statusClass(value);
  span.textContent = safeText(value) || "Unknown";
  return span;
}

async function checkStaffRole(user) {
  const { data, error } = await db
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Could not verify staff permissions: " + error.message
    );
  }

  if (!data || !["admin", "staff"].includes(
    safeText(data.role).toLowerCase()
  )) {
    throw new Error(
      "This account has not been authorized for staff access."
    );
  }

  currentRole = safeText(data.role).toLowerCase();

  showMessage(
    "staffInfo",
    "Signed in as " + user.email + " (" + currentRole + ")"
  );
}

async function loadOrders() {
  if (!currentRole) {
    throw new Error("Staff permissions have not been verified.");
  }

  showMessage("dashboardMessage", "Loading orders...");

  const { data, error } = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Could not load orders: " + error.message);
  }

  orders = data || [];
  orderItemNames = {};
  orderItemsByOrder = {};

  if (orders.length > 0) {
    const orderIds = orders.map(order => order.id);

    const { data: items, error: itemsError } = await db
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    if (itemsError) {
      console.error("Order items error:", itemsError);

      orders.forEach(order => {
        orderItemNames[String(order.id)] = "Items unavailable";
        orderItemsByOrder[String(order.id)] = [];
      });
    } else {
      const productIds = [
        ...new Set(
          (items || [])
            .map(item => item.product_id)
            .filter(id => id != null)
            .map(String)
        )
      ];

      const productsById = {};

      if (productIds.length > 0) {
        const { data: products, error: productError } = await db
          .from("products")
          .select("id, name, image_url")
          .in("id", productIds);

        if (productError) {
          console.error("Product details error:", productError);
        } else {
          (products || []).forEach(product => {
            productsById[String(product.id)] = product;
          });
        }
      }

      (items || []).forEach(item => {
        const key = String(item.order_id);
        const product =
          productsById[String(item.product_id)] || {};

        const name =
          item.product_name ||
          item.name ||
          product.name ||
          "Unnamed item";

        const imageUrl =
          item.image_url ||
          product.image_url ||
          "";

        if (!orderItemsByOrder[key]) {
          orderItemsByOrder[key] = [];
        }

        orderItemsByOrder[key].push({
          name,
          quantity: Number(item.quantity || 1),
          price: item.price ?? item.unit_price,
          image_url: imageUrl
        });
      });

      orders.forEach(order => {
        const key = String(order.id);
        const itemsForOrder = orderItemsByOrder[key] || [];

        orderItemNames[key] = itemsForOrder.length
          ? itemsForOrder.map(item =>
              item.name +
              (item.quantity > 1 ? " × " + item.quantity : "")
            ).join(", ")
          : "No items found";
      });
    }
  }

  renderOrders();

  showMessage(
    "dashboardMessage",
    "Orders refreshed. " + orders.length + " order(s) loaded."
  );
}

/* =====================================================
   RENDER CUSTOMER ORDERS
   10 columns:
   Order ID | Image | Item Name | Customer | Contact
   | Total | Payment | M-PESA Ref | Delivery | Actions
===================================================== */

function renderOrders() {
  const tbody = $("ordersBody");

  if (!tbody) {
    console.error("Missing ordersBody in staff.html");
    return;
  }

  const search = $("searchInput")
    ? $("searchInput").value.trim().toLowerCase()
    : "";

  tbody.replaceChildren();

  const filtered = orders.filter(order => {
    const searchable = [
      order.id,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.mpesa_phone,
      order.mpesa_receipt_number,
      orderItemNames[String(order.id)]
    ].map(safeText).join(" ").toLowerCase();

    return searchable.includes(search);
  });

  if ($("totalOrders")) {
    $("totalOrders").textContent = orders.length;
  }

  if ($("paidOrders")) {
    $("paidOrders").textContent = orders.filter(
      order => safeText(order.payment_status).toLowerCase() === "paid"
    ).length;
  }

  if ($("unpaidOrders")) {
    $("unpaidOrders").textContent = orders.filter(
      order => ["unpaid", "pending"].includes(
        safeText(order.payment_status).toLowerCase()
      )
    ).length;
  }

  if ($("deliveredOrders")) {
    $("deliveredOrders").textContent = orders.filter(
      order => safeText(order.delivery_status).toLowerCase() === "delivered"
    ).length;
  }

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = makeCell("No matching orders found.");
    td.colSpan = 10;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach(order => {
    const tr = document.createElement("tr");
    const items = orderItemsByOrder[String(order.id)] || [];

    // 1. Order ID
    tr.appendChild(makeCell(order.id));

    // 2. Item image
    const imageCell = document.createElement("td");

    if (items.length > 0) {
      items.forEach(item => {
        if (item.image_url) {
          const img = document.createElement("img");

          img.src = item.image_url;
          img.alt = item.name || "Ordered product";
          img.loading = "lazy";
          img.style.width = "55px";
          img.style.height = "55px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "6px";
          img.style.margin = "3px";

          imageCell.appendChild(img);
        }
      });
    }

    if (!imageCell.hasChildNodes()) {
      imageCell.textContent = "No image";
    }

    tr.appendChild(imageCell);

    // 3. Item name — separate from image and customer
    const nameCell = document.createElement("td");

    if (items.length > 0) {
      items.forEach(item => {
        const itemName = document.createElement("div");

        itemName.textContent =
          (item.name || "Unnamed item") +
          (item.quantity > 1 ? " × " + item.quantity : "");

        itemName.style.marginBottom = "6px";
        nameCell.appendChild(itemName);
      });
    } else {
      nameCell.textContent =
        orderItemNames[String(order.id)] || "No items found";
    }

    tr.appendChild(nameCell);

    // 4. Customer name — shown only once
    tr.appendChild(
      makeCell(order.customer_name || "Name not saved")
    );

    // 5. Contact details
    const contact = [
      order.customer_email,
      order.customer_phone || order.mpesa_phone
    ].filter(Boolean).join(" / ");

    tr.appendChild(
      makeCell(contact || "Contact not saved")
    );

    // 6. Total amount
    tr.appendChild(makeCell(money(order.total_amount)));

    // 7. Payment status
    tr.appendChild(
      makeStatus(order.payment_status || "Pending")
    );

    // 8. M-PESA reference
    tr.appendChild(
      makeCell(order.mpesa_receipt_number || "Not paid yet")
    );

    // 9. Delivery status
    tr.appendChild(
      makeStatus(order.delivery_status || "pending")
    );

    // 10. Delivery update controls
    const actionCell = document.createElement("td");
    const select = document.createElement("select");

    select.setAttribute(
      "aria-label",
      "Delivery status for order " + order.id
    );

    const statuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled"
    ];

    statuses.forEach(status => {
      const option = document.createElement("option");

      option.value = status;
      option.textContent =
        status.charAt(0).toUpperCase() + status.slice(1);

      select.appendChild(option);
    });

    const currentStatus =
      safeText(order.delivery_status).toLowerCase();

    select.value = statuses.includes(currentStatus)
      ? currentStatus
      : "pending";

    const saveButton = document.createElement("button");

    saveButton.type = "button";
    saveButton.textContent = "Save";
    saveButton.className = "secondary-btn";

    saveButton.addEventListener("click", async () => {
      const newStatus = select.value;

      if (!confirm(
        "Update delivery status for this order to " +
        newStatus + "?"
      )) {
        return;
      }

      saveButton.disabled = true;

      showMessage(
        "dashboardMessage",
        "Saving delivery update..."
      );

      try {
        const { error } = await db
          .from("orders")
          .update({ delivery_status: newStatus })
          .eq("id", order.id);

        if (error) {
          throw error;
        }

        order.delivery_status = newStatus;

        renderOrders();

        showMessage(
          "dashboardMessage",
          "Delivery status saved successfully."
        );
      } catch (error) {
        console.error("Delivery update error:", error);

        showMessage(
          "dashboardMessage",
          "Delivery update failed: " + error.message
        );

        saveButton.disabled = false;
      }
    });

    actionCell.appendChild(select);
    actionCell.appendChild(document.createElement("br"));
    actionCell.appendChild(saveButton);

    tr.appendChild(actionCell);
    tbody.appendChild(tr);
  });
}

/* =====================================================
   LOGIN, LOGOUT AND DASHBOARD
===================================================== */

async function showDashboard(user) {
  const loginPanel = $("loginPanel");
  const dashboardPanel = $("dashboardPanel");

  if (loginPanel) loginPanel.hidden = true;
  if (dashboardPanel) dashboardPanel.hidden = false;

  try {
    await checkStaffRole(user);
    await loadOrders();
  } catch (error) {
    console.error("Dashboard error:", error);

    showMessage(
      "loginMessage",
      error.message || "Could not open staff dashboard."
    );

    if (dashboardPanel) dashboardPanel.hidden = true;
    if (loginPanel) loginPanel.hidden = false;
  }
}

async function checkSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    showMessage("loginMessage", error.message);
    return;
  }

  if (data.session) {
    await showDashboard(data.session.user);
  } else {
    if ($("loginPanel")) $("loginPanel").hidden = false;
    if ($("dashboardPanel")) $("dashboardPanel").hidden = true;
  }
}

/* LOGIN */

const loginForm = $("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = $("loginEmail")?.value.trim();
    const password = $("loginPassword")?.value;

    if (!email || !password) {
      showMessage("loginMessage", "Enter your email and password.");
      return;
    }

    const loginButton = $("loginSubmit");
    if (loginButton) loginButton.disabled = true;

    showMessage("loginMessage", "Signing in...");

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        await showDashboard(data.user);
      }
    } catch (error) {
      console.error("Login error:", error);

      showMessage(
        "loginMessage",
        "Login failed: " + error.message
      );
    } finally {
      if (loginButton) loginButton.disabled = false;
    }
  });
}

/* LOGOUT */

const logoutBtn = $("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async function () {
    const { error } = await db.auth.signOut();

    if (error) {
      showMessage("dashboardMessage", error.message);
      return;
    }

    currentRole = null;
    orders = [];
    orderItemNames = {};
    orderItemsByOrder = {};

    if ($("dashboardPanel")) $("dashboardPanel").hidden = true;
    if ($("loginPanel")) $("loginPanel").hidden = false;

    showMessage("loginMessage", "You have signed out.");
  });
}

/* REFRESH ORDERS */

const refreshBtn = $("refreshBtn");

if (refreshBtn) {
  refreshBtn.addEventListener("click", async function () {
    try {
      await loadOrders();
    } catch (error) {
      showMessage("dashboardMessage", error.message);
    }
  });
}

/* SEARCH ORDERS */

const searchInput = $("searchInput");

if (searchInput) {
  searchInput.addEventListener("input", renderOrders);
}

/* KEEP DASHBOARD IN SYNC WITH AUTHENTICATION */

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentRole = null;

    if ($("dashboardPanel")) $("dashboardPanel").hidden = true;
    if ($("loginPanel")) $("loginPanel").hidden = false;
  }
});

/* =====================================================
   PRODUCT IMAGE PREVIEW
===================================================== */

const productImageInput = $("productImage");
const productPreview = $("productPreview");

if (productImageInput && productPreview) {
  productImageInput.addEventListener("change", function () {
    const file = this.files && this.files[0];

    if (!file) {
      productPreview.hidden = true;
      productPreview.removeAttribute("src");
      return;
    }

    if (!file.type.startsWith("image/")) {
      showMessage("productMessage", "Choose an image file.");
      this.value = "";
      productPreview.hidden = true;
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage(
        "productMessage",
        "Image is too large. Maximum size is 5 MB."
      );

      this.value = "";
      productPreview.hidden = true;
      return;
    }

    productPreview.src = URL.createObjectURL(file);
    productPreview.hidden = false;

    showMessage("productMessage", "Image ready to upload.");
  });
}

/* =====================================================
   ADD PRODUCT AND UPLOAD IMAGE TO SUPABASE STORAGE
===================================================== */

const addProductForm = $("addProductForm");

if (addProductForm) {
  addProductForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentRole) {
      showMessage(
        "productMessage",
        "Please sign in with an authorized staff account."
      );
      return;
    }

    const name = $("productName")?.value.trim();
    const category = $("productCategory")?.value;
    const price = Number($("productPrice")?.value);
    const oldPriceValue = $("productOldPrice")?.value;
    const color = $("productColor")?.value.trim() || "";
    const stock = Number($("productStock")?.value || 0);
    const file = productImageInput?.files?.[0];

    if (!name || !category || !Number.isFinite(price) || price <= 0) {
      showMessage(
        "productMessage",
        "Enter a product name, category and valid price."
      );
      return;
    }

    if (file && !file.type.startsWith("image/")) {
      showMessage("productMessage", "Choose a valid image file.");
      return;
    }

    if (file && file.size > 5 * 1024 * 1024) {
      showMessage(
        "productMessage",
        "Image is too large. Maximum size is 5 MB."
      );
      return;
    }

    const submitButton = addProductForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) submitButton.disabled = true;

    showMessage("productMessage", "Adding product...");

    let imageUrl = "";

    try {
      if (file) {
        const safeFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, "_");

        const filePath =
          Date.now() + "_" + safeFileName;

        const { error: uploadError } = await db.storage
          .from("product-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false
          });

        if (uploadError) {
          throw new Error(
            "Image upload failed: " + uploadError.message
          );
        }

        const { data: publicData } = db.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = publicData.publicUrl;
      }

      const product = {
        name,
        category,
        price,
        old_price:
          oldPriceValue !== "" && oldPriceValue != null
            ? Number(oldPriceValue)
            : null,
        image_url: imageUrl || null,
        color,
        stock,
        is_active: true
      };

      const { error: insertError } = await db
        .from("products")
        .insert(product);

      if (insertError) {
        throw new Error(
          "Product could not be saved: " + insertError.message
        );
      }

      addProductForm.reset();

      if (productPreview) {
        productPreview.hidden = true;
        productPreview.removeAttribute("src");
      }

      showMessage(
        "productMessage",
        "Product added successfully!"
      );
    } catch (error) {
      console.error("Add product error:", error);

      showMessage(
        "productMessage",
        error.message || "Could not add product."
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

/* =====================================================
   DASHBOARD NAVIGATION
===================================================== */

function showStaffSection(section) {
  if ($("homePanel")) {
    $("homePanel").hidden = section !== "home";
  }

  if ($("productPanel")) {
    $("productPanel").hidden = section !== "product";
  }

  if ($("customerOrdersPanel")) {
    $("customerOrdersPanel").hidden = section !== "orders";
  }
}

const customerOrdersBtn = $("customerOrdersBtn");

if (customerOrdersBtn) {
  customerOrdersBtn.addEventListener("click", async function () {
    showStaffSection("orders");

    try {
      await loadOrders();
    } catch (error) {
      showMessage("dashboardMessage", error.message);
    }
  });
}

const addProductMenuBtn = $("addProductMenuBtn");

if (addProductMenuBtn) {
  addProductMenuBtn.addEventListener("click", function () {
    showStaffSection("product");
  });
}

const backFromProductBtn = $("backFromProductBtn");

if (backFromProductBtn) {
  backFromProductBtn.addEventListener("click", function () {
    showStaffSection("home");
  });
}

const backFromOrdersBtn = $("backFromOrdersBtn");

if (backFromOrdersBtn) {
  backFromOrdersBtn.addEventListener("click", function () {
    showStaffSection("home");
  });
}

/* ROYAL FITS - REGISTERED USERS */

const usersBtn = document.getElementById("usersBtn");
const usersPanel = document.getElementById("usersPanel");
const usersTableBody = document.getElementById("usersTableBody");
const usersMessage = document.getElementById("usersMessage");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");

async function loadRegisteredUsers() {
  usersMessage.textContent = "Loading registered users...";
  usersTableBody.replaceChildren();

  try {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error("Please log in to the staff dashboard first.");
    }

    let page = 1;
    let allUsers = [];
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await db.functions.invoke(
        "staff-users",
        { body: { page } }
      );

      if (error) throw error;
      if (!data || data.error) {
        throw new Error(data?.error || "Could not load users.");
      }

      allUsers = allUsers.concat(data.users || []);
      hasMore = data.hasMore === true;
      page++;
    }

    if (allUsers.length === 0) {
      usersTableBody.innerHTML =
        '<tr><td colspan="4">No registered users found.</td></tr>';
    } else {
      allUsers.forEach((user) => {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = user.full_name || "Not provided";

        const emailCell = document.createElement("td");
        emailCell.textContent = user.email || "Not provided";

        const phoneCell = document.createElement("td");
        phoneCell.textContent = user.phone || "Not provided";

        const dateCell = document.createElement("td");
        dateCell.textContent = user.created_at
          ? new Date(user.created_at).toLocaleString()
          : "Not available";

        row.append(nameCell, emailCell, phoneCell, dateCell);
        usersTableBody.appendChild(row);
      });
    }

    usersMessage.textContent =
      "Registered users: " + allUsers.length;
  } catch (error) {
    console.error("Users loading error:", error);
    usersMessage.textContent =
      error.message || "Failed to load users.";
  }
}

usersBtn?.addEventListener("click", () => {
  usersPanel.hidden = false;
  loadRegisteredUsers();
});

refreshUsersBtn?.addEventListener("click", loadRegisteredUsers);

/* START THE STAFF DASHBOARD */

checkSession();
