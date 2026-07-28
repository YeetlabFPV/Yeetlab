const BASE_FRAME_PRICE = 80;
const SHIPPING_PRICE = 10;
const CHECKOUT_ENDPOINT = "https://yeetlab-checkout.tmw-fpv.workers.dev/checkout";

const form = document.querySelector("#order-form");
const totalElement = document.querySelector("#order-total");
const checkoutButton = document.querySelector("#checkout-button");
const addonInputs = [...document.querySelectorAll('input[name="addon"]')];
const galleryMain = document.querySelector("#gallery-main");
const galleryButtons = [...document.querySelectorAll("[data-gallery-src]")];
let checkoutInProgress = false;

function selectedAddons() {
  return addonInputs
    .map((input) => ({
      key: input.dataset.key,
      price: Number(input.dataset.price || 0),
      quantity: normalizedQuantity(input.value),
    }))
    .filter((addon) => addon.quantity > 0);
}

function normalizedQuantity(value) {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isFinite(quantity)) {
    return 0;
  }

  return Math.min(20, Math.max(0, quantity));
}

function orderTotal() {
  return selectedAddons().reduce((sum, addon) => {
    return sum + addon.price * addon.quantity;
  }, BASE_FRAME_PRICE + SHIPPING_PRICE);
}

function updateTotal() {
  addonInputs.forEach((input) => {
    const quantity = normalizedQuantity(input.value);
    if (input.value !== String(quantity)) {
      input.value = String(quantity);
    }
    input.closest(".addon")?.classList.toggle("has-quantity", quantity > 0);
  });
  totalElement.textContent = `CHF ${orderTotal()}`;
  if (!checkoutInProgress) {
    checkoutButton.textContent = `Pay estimated CHF ${orderTotal()} with Stripe`;
  }
}

addonInputs.forEach((input) => {
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
    const response = await fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: selectedAddons().map(({ key, quantity }) => ({ key, quantity })),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
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
