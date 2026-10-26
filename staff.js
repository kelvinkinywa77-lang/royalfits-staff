
/* =====================================================
   ROYAL FITS BOUTIQUE254
   COMPLETE STAFF DASHBOARD
===================================================== */

/* 1. SUPABASE CONNECTION */

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

/* 2. GLOBAL ERROR MESSAGES */

window.addEventListener("error", function (event) {
  showMessage("loginMessage", "JavaScript error: " + event.message);
});

window.addEventListener("unhandledrejection", function (event) {
  showMessage(
    "loginMessage",
    "Error: " +
      (event.reason?.message || String(event.reason))
  );
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

  if (["paid", "successful", "delivered", "active"].includes(status)) {
    return "paid";
  }

  if (
    ["failed", "cancelled", "canceled", "removed"].includes(status)
  ) {
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

/* =====================================================
   3. VERIFY STAFF PERMISSIONS
===================================================== */

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

  const role = safeText(data?.role).toLowerCase();

  if (!["admin", "staff"].includes(role)) {
    throw new Error(
      "This account has not been authorized for staff access."
    );
  }

  currentRole = role;

  showMessage(
    "staffInfo",
    "Signed in as " + user.email + " (" + currentRole + ")"
  );

  if ($("logoutBtn")) $("logoutBtn").hidden = false;
}

/* =====================================================
   4. LOAD CUSTOMER ORDERS AND ORDER ITEMS
===================================================== */

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
   5. RENDER CUSTOMER ORDERS
===================================================== */

function renderOrders() {
  const tbody = $("ordersBody");

  if (!tbody) return;

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
    $("paidOrders").textContent = orders.filter(order =>
      safeText(order.payment_status).toLowerCase() === "paid"
    ).length;
  }

  if ($("unpaidOrders")) {
    $("unpaidOrders").textContent = orders.filter(order =>
      ["unpaid", "pending"].includes(
        safeText(order.payment_status).toLowerCase()
      )
    ).length;
  }

  if ($("deliveredOrders")) {
    $("deliveredOrders").textContent = orders.filter(order =>
      safeText(order.delivery_status).toLowerCase() === "delivered"
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

    tr.appendChild(makeCell(order.id));

    /* Item images */
    const imageCell = document.createElement("td");

    items.forEach(item => {
      if (!item.image_url) return;

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
    });

    if (!imageCell.hasChildNodes()) {
      imageCell.textContent = "No image";
    }

    tr.appendChild(imageCell);

    /* Item names */
    const nameCell = document.createElement("td");

    if (items.length > 0) {
      items.forEach(item => {
        const itemName = document.createElement("div");

        itemName.textContent =
          item.name +
          (item.quantity > 1 ? " × " + item.quantity : "");

        itemName.style.marginBottom = "6px";
        nameCell.appendChild(itemName);
      });
    } else {
      nameCell.textContent =
        orderItemNames[String(order.id)] || "No items found";
    }

    tr.appendChild(nameCell);

    tr.appendChild(
      makeCell(order.customer_name || "Name not saved")
    );

    const contact = [
      order.customer_email,
      order.customer_phone || order.mpesa_phone
    ].filter(Boolean).join(" / ");

    tr.appendChild(makeCell(contact || "Contact not saved"));
    tr.appendChild(makeCell(money(order.total_amount)));
    tr.appendChild(makeStatus(order.payment_status || "Pending"));
    tr.appendChild(
      makeCell(order.mpesa_receipt_number || "Not paid yet")
    );
    tr.appendChild(makeStatus(order.delivery_status || "pending"));

    /* Delivery update */
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
      )) return;

      saveButton.disabled = true;
      showMessage("dashboardMessage", "Saving delivery update...");

      try {
        const { error } = await db
          .from("orders")
          .update({ delivery_status: newStatus })
          .eq("id", order.id);

        if (error) throw error;

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
   6. DASHBOARD NAVIGATION
===================================================== */

function showStaffSection(section) {
  if ($("homePanel")) {
    $("homePanel").hidden = section !== "home";
  }

  if ($("productPanel")) {
    $("productPanel").hidden = section !== "product";
  }

  if ($("viewProductsPanel")) {
    $("viewProductsPanel").hidden = section !== "viewProducts";
  }

  if ($("customerOrdersPanel")) {
    $("customerOrdersPanel").hidden = section !== "orders";
  }

  if ($("usersPanel")) {
    $("usersPanel").hidden = section !== "users";
  }
}

$("customerOrdersBtn")?.addEventListener("click", async () => {
  showStaffSection("orders");

  try {
    await loadOrders();
  } catch (error) {
    showMessage("dashboardMessage", error.message);
  }
});

$("addProductMenuBtn")?.addEventListener("click", () => {
  showStaffSection("product");
});

$("backFromProductBtn")?.addEventListener("click", () => {
  showStaffSection("home");
});

$("backFromOrdersBtn")?.addEventListener("click", () => {
  showStaffSection("home");
});

/* =====================================================
   7. REGISTERED USERS
===================================================== */

const usersBtn = $("usersBtn");
const usersTableBody = $("usersTableBody");
const refreshUsersBtn = $("refreshUsersBtn");

async function loadRegisteredUsers() {
  if (!currentRole) {
    showMessage(
      "usersMessage",
      "You must sign in with an authorized staff account."
    );
    return;
  }

  if (!usersTableBody) return;

  showMessage("usersMessage", "Loading registered users...");
  usersTableBody.replaceChildren();

  if (refreshUsersBtn) refreshUsersBtn.disabled = true;

  try {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      throw new Error("Please log in first.");
    }

    let page = 1;
    const allUsers = [];
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await db.functions.invoke(
        "staff-users",
        { body: { page } }
      );

      if (error) throw error;

      if (!data || data.error) {
        throw new Error(
          data?.error || "Could not load registered users."
        );
      }

      allUsers.push(...(data.users || []));
      hasMore = data.hasMore === true;
      page++;

      if (page > 1000) {
        throw new Error("Too many pages returned.");
      }
    }

    if (allUsers.length === 0) {
      const row = document.createElement("tr");
      const cell = makeCell("No registered users found.");
      cell.colSpan = 4;
      row.appendChild(cell);
      usersTableBody.appendChild(row);
    } else {
      allUsers.forEach(user => {
        const row = document.createElement("tr");

        row.append(
          makeCell(user.full_name || "Not provided"),
          makeCell(user.email || "Not provided"),
          makeCell(user.phone || "Not provided"),
          makeCell(
            user.created_at
              ? new Date(user.created_at).toLocaleString()
              : "Not available"
          )
        );

        usersTableBody.appendChild(row);
      });
    }

    showMessage(
      "usersMessage",
      "Registered users: " + allUsers.length
    );

  } catch (error) {
    console.error("Users loading error:", error);

    const row = document.createElement("tr");
    const cell = makeCell("Unable to load users.");
    cell.colSpan = 4;
    row.appendChild(cell);
    usersTableBody.appendChild(row);

    showMessage("usersMessage", error.message);

  } finally {
    if (refreshUsersBtn) refreshUsersBtn.disabled = false;
  }
}

usersBtn?.addEventListener("click", async () => {
  showStaffSection("users");
  await loadRegisteredUsers();
});

refreshUsersBtn?.addEventListener("click", loadRegisteredUsers);

$("backFromUsersBtn")?.addEventListener("click", () => {
  showStaffSection("home");
});

/* =====================================================
   8. VIEW PRODUCTS AND REMOVE PRODUCTS
===================================================== */

async function loadStaffProducts() {
  if (!currentRole) {
    showMessage(
      "productsMessage",
      "Please sign in with an authorized staff account."
    );
    return;
  }

  const tbody = $("productsTableBody");
  const refreshBtn = $("refreshProductsBtn");

  if (!tbody) return;

  tbody.replaceChildren();

  const loadingRow = document.createElement("tr");
  const loadingCell = makeCell("Loading products...");
  loadingCell.colSpan = 7;
  loadingRow.appendChild(loadingCell);
  tbody.appendChild(loadingRow);

  if (refreshBtn) refreshBtn.disabled = true;

  showMessage("productsMessage", "Loading products...");

  try {
    const { data: products, error } = await db
      .from("products")
      .select("id, name, category, price, stock, is_active, image_url")
      .order("id", { ascending: false });

    if (error) throw error;

    tbody.replaceChildren();

    if (!products || products.length === 0) {
      const row = document.createElement("tr");
      const cell = makeCell("No products found.");
      cell.colSpan = 7;
      row.appendChild(cell);
      tbody.appendChild(row);

      showMessage("productsMessage", "No products found.");
      return;
    }

    products.forEach(product => {
      const row = document.createElement("tr");

      /* Product image */
      const imageCell = document.createElement("td");

      if (product.image_url) {
        const img = document.createElement("img");
        img.src = product.image_url;
        img.alt = product.name || "Product image";
        img.loading = "lazy";
        img.style.width = "65px";
        img.style.height = "65px";
        img.style.objectFit = "contain";
        img.style.borderRadius = "6px";

        img.onerror = () => {
          img.alt = "Image unavailable";
          img.removeAttribute("src");
        };

        imageCell.appendChild(img);
      } else {
        imageCell.textContent = "No image";
      }

      row.appendChild(imageCell);
      row.appendChild(makeCell(product.name));
      row.appendChild(makeCell(product.category));
      row.appendChild(makeCell(money(product.price)));
      row.appendChild(makeCell(product.stock ?? 0));

      /* Product status */
      const statusCell = document.createElement("td");
      const active = product.is_active === true;

      statusCell.appendChild(
        makeStatus(active ? "Active" : "Removed")
      );

      row.appendChild(statusCell);

      /* Product action */
      const actionCell = document.createElement("td");

      if (!active) {
        actionCell.textContent = "Already removed";

      } else if (currentRole !== "admin") {
        actionCell.textContent = "Admin only";

      } else {
        const removeBtn = document.createElement("button");

        removeBtn.type = "button";
        removeBtn.textContent = "Remove";
        removeBtn.className = "secondary-btn";

        removeBtn.addEventListener("click", async () => {
          if (currentRole !== "admin") {
            showMessage(
              "productsMessage",
              "Only administrators can remove products."
            );
            return;
          }

          const confirmed = confirm(
            'Remove "' + product.name +
            '" from the online shop? This deactivates the product ' +
            "without permanently deleting its record."
          );

          if (!confirmed) return;

          removeBtn.disabled = true;
          showMessage("productsMessage", "Removing product...");

          try {
            const { data: updatedRows, error: updateError } =
              await db
                .from("products")
                .update({ is_active: false })
                .eq("id", product.id)
                .eq("is_active", true)
                .select("id");

            if (updateError) {
  console.error("Supabase product update details:", {
    message: updateError.message,
    code: updateError.code,
    details: updateError.details,
    hint: updateError.hint
  });

  throw new Error(
    updateError.message +
    (updateError.code ? " (Code: " + updateError.code + ")" : "") +
    (updateError.details ? " Details: " + updateError.details : "") +
    (updateError.hint ? " Hint: " + updateError.hint : "")
  );
}

            if (!updatedRows || updatedRows.length === 0) {
              throw new Error(
                "No product was updated. Check your Supabase permissions."
              );
            }

            showMessage(
              "productsMessage",
              "Product removed from the shop."
            );

            await loadStaffProducts();

          } catch (error) {
            console.error("Remove product error:", error);

            showMessage(
              "productsMessage",
              "Could not remove product: " + error.message
            );

            removeBtn.disabled = false;
          }
        });

        actionCell.appendChild(removeBtn);
      }

      row.appendChild(actionCell);
      tbody.appendChild(row);
    });

    showMessage(
      "productsMessage",
      products.length + " product(s) loaded."
    );

  } catch (error) {
    console.error("Load products error:", error);

    tbody.replaceChildren();

    const row = document.createElement("tr");
    const cell = makeCell("Unable to load products.");
    cell.colSpan = 7;
    row.appendChild(cell);
    tbody.appendChild(row);

    showMessage(
      "productsMessage",
      "Could not load products: " + error.message
    );

  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

/* Open products panel */
$("viewProductsMenuBtn")?.addEventListener("click", async () => {
  showStaffSection("viewProducts");
  await loadStaffProducts();
});

/* Refresh products */
$("refreshProductsBtn")?.addEventListener("click", async () => {
  await loadStaffProducts();
});

/* Back from products */
$("backFromViewProductsBtn")?.addEventListener("click", () => {
  showStaffSection("home");
});

/* =====================================================
   9. LOGIN AND SESSION MANAGEMENT
===================================================== */

async function showDashboard(user) {
  if ($("loginPanel")) $("loginPanel").hidden = true;
  if ($("dashboardPanel")) $("dashboardPanel").hidden = false;
  if ($("logoutBtn")) $("logoutBtn").hidden = false;

  try {
    await checkStaffRole(user);
    showStaffSection("home");
    await loadOrders();

  } catch (error) {
    console.error("Dashboard error:", error);

    currentRole = null;

    showMessage(
      "loginMessage",
      error.message || "Could not open staff dashboard."
    );

    if ($("dashboardPanel")) $("dashboardPanel").hidden = true;
    if ($("loginPanel")) $("loginPanel").hidden = false;
    if ($("logoutBtn")) $("logoutBtn").hidden = true;
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
    if ($("logoutBtn")) $("logoutBtn").hidden = true;
  }
}

/* Staff login */
$("loginForm")?.addEventListener("submit", async event => {
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
    showMessage("loginMessage", "Login failed: " + error.message);

  } finally {
    if (loginButton) loginButton.disabled = false;
  }
});

/* Staff logout */
$("logoutBtn")?.addEventListener("click", async () => {
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
  if ($("logoutBtn")) $("logoutBtn").hidden = true;

  showMessage("loginMessage", "You have signed out.");
});

/* Refresh orders */
$("refreshBtn")?.addEventListener("click", async () => {
  try {
    await loadOrders();
  } catch (error) {
    showMessage("dashboardMessage", error.message);
  }
});

/* Search orders */
$("searchInput")?.addEventListener("input", renderOrders);

/* Authentication changes */
db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    currentRole = null;

    if ($("dashboardPanel")) $("dashboardPanel").hidden = true;
    if ($("loginPanel")) $("loginPanel").hidden = false;
    if ($("logoutBtn")) $("logoutBtn").hidden = true;
  }
});

/* =====================================================
   10. PRODUCT IMAGE PREVIEW
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
   11. ADD PRODUCT AND UPLOAD IMAGE
===================================================== */

$("addProductForm")?.addEventListener("submit", async event => {
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

  if (!Number.isInteger(stock) || stock < 0) {
    showMessage("productMessage", "Enter a valid stock quantity.");
    return;
  }

  if (!file) {
    showMessage("productMessage", "Choose a product image.");
    return;
  }

  if (!file.type.startsWith("image/")) {
    showMessage("productMessage", "Choose a valid image file.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showMessage(
      "productMessage",
      "Image is too large. Maximum size is 5 MB."
    );
    return;
  }

  const submitButton = $("addProductBtn");
  if (submitButton) submitButton.disabled = true;

  showMessage("productMessage", "Uploading image and adding product...");

  let uploadedFilePath = null;

  try {
    const safeFileName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const filePath = Date.now() + "_" + safeFileName;

    const { error: uploadError } = await db.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      throw new Error("Image upload failed: " + uploadError.message);
    }

    uploadedFilePath = filePath;

    const { data: publicData } = db.storage
      .from("product-images")
      .getPublicUrl(filePath);

    const product = {
      name,
      category,
      price,
      old_price:
        oldPriceValue !== "" && oldPriceValue != null
          ? Number(oldPriceValue)
          : null,
      image_url: publicData.publicUrl,
      color,
      stock,
      is_active: true
    };

    const { error: insertError } = await db
      .from("products")
      .insert(product);

    if (insertError) throw insertError;

    $("addProductForm").reset();

    if (productPreview) {
      productPreview.hidden = true;
      productPreview.removeAttribute("src");
    }

    showMessage("productMessage", "Product added successfully!");

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

/* =====================================================
   12. START DASHBOARD
===================================================== */

checkSession();
