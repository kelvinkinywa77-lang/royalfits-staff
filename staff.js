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

/*
  IMPORTANT:
  This starter assumes a public.staff_roles table with
  user_id and role columns, and an orders table containing:
  id, customer_name, customer_email, customer_phone,
  total_amount, payment_status and delivery_status.

  Change the order column names below to match your real
  Supabase table before using the dashboard live.
*/

function showMessage(elementId, message) {
  $(elementId).textContent = message;
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
  const normalized = safeText(value).toLowerCase();

  if (["paid", "delivered"].includes(normalized)) {
    return "paid";
  }

  if (["failed", "cancelled"].includes(normalized)) {
    return "failed";
  }

  if (["unpaid", "pending", "processing"].includes(normalized)) {
    return "pending";
  }

  return "";
}

function makeCell(text) {
  const td = document.createElement("td");
  td.textContent = safeText(text);
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
      "Could not verify staff permissions. Check your staff_roles table and its security policies."
    );
  }

  if (!data || !["admin", "staff"].includes(data.role)) {
    throw new Error(
      "This account has not been authorized for staff dashboard access."
    );
  }

  currentRole = data.role;
  $("staffInfo").textContent =
    "Signed in as " + user.email + " (" + currentRole + ")";
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
    console.error("Supabase orders error:", error);
    throw new Error("Could not load orders: " + error.message);
  }

  orders = data || [];
  renderOrders();

  showMessage(
    "dashboardMessage",
    "Orders refreshed. " + orders.length + " order(s) loaded."
  );
}


function renderOrders() {
  const tbody = $("ordersBody");
  const search = $("searchInput").value.trim().toLowerCase();

  tbody.replaceChildren();

  const filtered = orders.filter((order) => {
    const searchable = [
      order.id,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.mpesa_phone,
      order.mpesa_receipt_number
    ].map(safeText).join(" ").toLowerCase();

    return searchable.includes(search);
  });

  // Dashboard statistics
  $("totalOrders").textContent = orders.length;

  $("paidOrders").textContent = orders.filter(
    (o) => safeText(o.payment_status).toLowerCase() === "paid"
  ).length;

  $("unpaidOrders").textContent = orders.filter(
    (o) => ["unpaid", "pending"].includes(
      safeText(o.payment_status).toLowerCase()
    )
  ).length;

  $("deliveredOrders").textContent = orders.filter(
    (o) => safeText(o.delivery_status).toLowerCase() === "delivered"
  ).length;

  if (!filtered.length) {
    const tr = document.createElement("tr");
    const td = makeCell("No matching orders found.");
    td.colSpan = 8;
    tr.append(td);
    tbody.append(tr);
    return;
  }

  filtered.forEach((order) => {
    const tr = document.createElement("tr");

    // 1. Order ID
    tr.append(makeCell(order.id));

    // 2. Customer name
    tr.append(makeCell(order.customer_name || "Name not saved"));

    // 3. Contact details
    const contact = [
      order.customer_email,
      order.customer_phone || order.mpesa_phone
    ].filter(Boolean).join(" / ");

    tr.append(makeCell(contact || "Contact not saved"));

    // 4. Total amount
    tr.append(makeCell(money(order.total_amount)));

    // 5. Payment status
    tr.append(makeStatus(order.payment_status || "Pending"));

    // 6. M-PESA reference
    tr.append(
      makeCell(order.mpesa_receipt_number || "Not paid yet")
    );

    // 7. Current delivery status
    tr.append(makeStatus(order.delivery_status || "pending"));

    // 8. Delivery update controls
    const actionCell = document.createElement("td");
    const select = document.createElement("select");

    select.setAttribute(
      "aria-label",
      "Update delivery status for order " + order.id
    );

    const statuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled"
    ];

    statuses.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent =
        status.charAt(0).toUpperCase() + status.slice(1);
      select.append(option);
    });

    const currentStatus =
      safeText(order.delivery_status).toLowerCase();

    select.value = statuses.includes(currentStatus)
      ? currentStatus
      : "pending";

    const updateButton = document.createElement("button");
    updateButton.type = "button";
    updateButton.textContent = "Save";
    updateButton.className = "secondary-btn";
    updateButton.style.marginTop = "8px";

    updateButton.addEventListener("click", async () => {
      const newStatus = select.value;

      if (!confirm(
        "Update delivery status for order " +
        order.id + " to " + newStatus + "?"
      )) {
        return;
      }

      updateButton.disabled = true;
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
      } finally {
        updateButton.disabled = false;
      }
    });

    actionCell.append(select);
    actionCell.append(document.createElement("br"));
    actionCell.append(updateButton);

    tr.append(actionCell);
    tbody.append(tr);
  });
}

    select.value = [
      "pending", "processing", "shipped", "delivered", "cancelled"
    ].includes(safeText(order.delivery_status).toLowerCase())
      ? safeText(order.delivery_status).toLowerCase()
      : "pending";

    const updateButton = document.createElement("button");
    updateButton.type = "button";
    updateButton.textContent = "Save";
    updateButton.className = "secondary-btn";
    updateButton.style.marginTop = "8px";

    updateButton.addEventListener("click", async () => {
      if (!confirm("Update delivery status for order " + order.id + "?")) {
        return;
      }

      updateButton.disabled = true;

      try {
        /*
          Delivery updates are only safe once your orders
          table has an appropriate staff-only UPDATE policy.
        */
        const { error } = await db
          .from("orders")
          .update({ delivery_status: select.value })
          .eq("id", order.id);

        if (error) throw error;

        order.delivery_status = select.value;
        renderOrders();
        showMessage("dashboardMessage", "Delivery status updated.");
      } catch (error) {
        console.error(error);
        showMessage(
          "dashboardMessage",
          "Update failed. Check the delivery_status column and staff-only database permissions."
        );
      } finally {
        updateButton.disabled = false;
      }
    });

    actionCell.append(select, document.createElement("br"), updateButton);
    tr.append(actionCell);
    tbody.append(tr);
  });
}

async function showDashboard(user) {
  $("loginPanel").hidden = true;
  $("dashboardPanel").hidden = false;
  $("logoutBtn").hidden = false;

  try {
    await checkStaffRole(user);
    await loadOrders();
  } catch (error) {
    console.error(error);
    currentRole = null;
    showMessage("dashboardMessage", error.message);
    $("ordersBody").replaceChildren();
  }
}

async function checkSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    showMessage("loginMessage", "Could not check your login session.");
    return;
  }

  if (data.session?.user) {
    await showDashboard(data.session.user);
  }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  showMessage("loginMessage", "Signing in...");

  const email = $("email").value.trim();
  const password = $("password").value;

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("loginMessage", "Sign-in failed: " + error.message);
    return;
  }

  await showDashboard(data.user);
});

$("logoutBtn").addEventListener("click", async () => {
  await db.auth.signOut();

  currentRole = null;
  orders = [];

  $("dashboardPanel").hidden = true;
  $("loginPanel").hidden = false;
  $("logoutBtn").hidden = true;

  showMessage("loginMessage", "You have signed out.");
});

$("refreshBtn").addEventListener("click", async () => {
  try {
    await loadOrders();
  } catch (error) {
    showMessage("dashboardMessage", error.message);
  }
});

$("searchInput").addEventListener("input", renderOrders);

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    currentRole = null;
    orders = [];
    $("dashboardPanel").hidden = true;
    $("loginPanel").hidden = false;
    $("logoutBtn").hidden = true;
  }
});

checkSession();

