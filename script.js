const BASE_FRAME_PRICE = 80;
const SHIPPING_PRICE = 10;

const STRIPE_PAYMENT_LINKS = {
  frame: "https://buy.stripe.com/test_replace-with-shreddo-5-link",
  // Optional: add dedicated Stripe Payment Links for selected spare-part combos.
  // Example key: "frame+arm+top-plate"
};

const form = document.querySelector("#order-form");
const totalElement = document.querySelector("#order-total");
const checkoutButton = document.querySelector("#checkout-button");
const addonInputs = [...document.querySelectorAll('input[name="addon"]')];
const galleryMain = document.querySelector("#gallery-main");
const galleryButtons = [...document.querySelectorAll("[data-gallery-src]")];

function selectedAddons() {
  return addonInputs
    .map((input) => ({
      key: input.dataset.key,
      price: Number(input.dataset.price || 0),
      quantity: Math.max(0, Number.parseInt(input.value, 10) || 0),
    }))
    .filter((addon) => addon.quantity > 0);
}

function orderTotal() {
  return selectedAddons().reduce((sum, addon) => {
    return sum + addon.price * addon.quantity;
  }, BASE_FRAME_PRICE + SHIPPING_PRICE);
}

function orderKey() {
  const addons = selectedAddons()
    .flatMap((addon) => Array.from({ length: addon.quantity }, () => addon.key))
    .sort();
  return ["frame", ...addons].join("+");
}

function updateTotal() {
  addonInputs.forEach((input) => {
    const quantity = Math.max(0, Number.parseInt(input.value, 10) || 0);
    input.closest(".addon")?.classList.toggle("has-quantity", quantity > 0);
  });
  totalElement.textContent = `CHF ${orderTotal()}`;
  checkoutButton.textContent = `Pay CHF ${orderTotal()} with Stripe`;
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

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const key = orderKey();
  const stripeLink = STRIPE_PAYMENT_LINKS[key] || STRIPE_PAYMENT_LINKS.frame;

  if (!stripeLink || stripeLink.includes("replace-with")) {
    alert("Add your real Stripe Payment Link in script.js before publishing checkout.");
    return;
  }

  window.location.href = stripeLink;
});

updateTotal();
