const SHIPPING_PRICE = 10;
const CHECKOUT_ENDPOINT = "https://yeetlab-checkout.tmw-fpv.workers.dev/checkout";

const form = document.querySelector("#order-form");
const subtotalElement = document.querySelector("#order-subtotal");
const shippingElement = document.querySelector("#order-shipping");
const totalElement = document.querySelector("#order-total");
const checkoutButton = document.querySelector("#checkout-button");
const itemInputs = [...document.querySelectorAll('input[name="item"]')];
const galleryMain = document.querySelector("#gallery-main");
const galleryButtons = [...document.querySelectorAll("[data-gallery-src]")];
let checkoutInProgress = false;

function selectedItems() {
  return itemInputs
    .map((input) => ({
      key: input.dataset.key,
      price: Number(input.dataset.price || 0),
      quantity: normalizedQuantity(input.value),
    }))
    .filter((addon) => addon.quantity > 0);
}

function selectedQuantity(key) {
  return normalizedQuantity(
    itemInputs.find((input) => input.dataset.key === key)?.value || 0,
  );
}

function legacyAddonPayload() {
  return selectedItems()
    .filter((item) => item.key !== "frame")
    .map(({ key, quantity }) => ({ key, quantity }));
}

function checkoutPayloadItems() {
  const frameInput = itemInputs.find((input) => input.dataset.key === "frame");
  const frameItem = {
    key: "frame",
    quantity: normalizedQuantity(frameInput?.value || 0),
  };

  return [
    frameItem,
    ...selectedItems()
      .filter((item) => item.key !== "frame")
      .map(({ key, quantity }) => ({ key, quantity })),
  ];
}

function shippingQuantity(items) {
  if (items.length === 0) {
    return 0;
  }

  return Math.max(1, selectedQuantity("frame"));
}

function normalizedQuantity(value) {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isFinite(quantity)) {
    return 0;
  }

  return Math.min(20, Math.max(0, quantity));
}

function orderTotal() {
  return orderSubtotal() + shippingTotal();
}

function orderSubtotal() {
  return selectedItems().reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
}

function shippingTotal() {
  const items = selectedItems();

  if (items.length === 0) {
    return 0;
  }

  return SHIPPING_PRICE * shippingQuantity(items);
}

function updateTotal() {
  const hasItems = selectedItems().length > 0;

  itemInputs.forEach((input) => {
    const quantity = normalizedQuantity(input.value);
    if (input.value !== String(quantity)) {
      input.value = String(quantity);
    }
    input.closest(".addon")?.classList.toggle("has-quantity", quantity > 0);
    input.closest(".order-line")?.classList.toggle("has-quantity", quantity > 0);
  });

  subtotalElement.textContent = `CHF ${orderSubtotal()}`;
  shippingElement.textContent = `CHF ${shippingTotal()}`;
  totalElement.textContent = `CHF ${orderTotal()}`;

  if (!checkoutInProgress) {
    checkoutButton.disabled = !hasItems;
    checkoutButton.textContent = hasItems
      ? `Pay estimated CHF ${orderTotal()} with Stripe`
      : "Select at least one item";
  }
}

itemInputs.forEach((input) => {
  input.addEventListener("input", updateTotal);
  input.addEventListener("change", updateTotal);
});

galleryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    galleryButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    galleryMain.src = button.dataset.gallerySrc;
    galleryMain.alt = button.dataset.galleryAlt;
  });
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (checkoutInProgress) {
    return;
  }

  checkoutInProgress = true;
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Opening Stripe...";

  try {
    const items = checkoutPayloadItems();
    let response = await fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items,
      }),
    });

    let data = await response.json().catch(() => ({}));

    if (
      !response.ok &&
      data.error?.includes("Unknown product key: frame") &&
      selectedQuantity("frame") === 1
    ) {
      response = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: legacyAddonPayload(),
        }),
      });
      data = await response.json().catch(() => ({}));
    }

    if (!response.ok || !data.url) {
      if (
        data.error?.includes("Unknown product key: frame") &&
        selectedQuantity("frame") === 0
      ) {
        throw new Error(
          "Spare-only checkout is ready on the website, but the checkout worker still needs to be updated.",
        );
      }

      throw new Error(data.error || "Checkout could not be started. Please try again.");
    }

    window.location.href = data.url;
  } catch (error) {
    alert(error.message || "Checkout could not be started. Please try again.");
    checkoutInProgress = false;
    checkoutButton.disabled = false;
    updateTotal();
  }
});

updateTotal();
