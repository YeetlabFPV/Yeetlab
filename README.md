# Yeetlab Shreddo 5 Website

Static product page for GitHub Pages with a simple Stripe Payment Link checkout.

## Customize content

- `index.html`: product copy, contact email, product names
- `styles.css`: visual design
- `script.js`: prices and Stripe Payment Links
- `assets/`: logo and product images

## Adding future product images

Add the image file to `assets/`, then add another thumbnail button in the
`product-gallery` block in `index.html` with `data-gallery-src` pointing to the
new file. The main gallery image will switch automatically.

## Stripe setup

This is a static GitHub Pages site, so it cannot securely create dynamic Stripe
Checkout sessions on its own. The simplest setup is Stripe Payment Links.

In `script.js`, replace the placeholder link:

```js
frame: "https://buy.stripe.com/test_replace-with-shreddo-5-link"
```

If you want the add-on checkboxes to lead to exact Stripe totals, create Payment
Links in Stripe for the combinations you want to support and add them to
`STRIPE_PAYMENT_LINKS`.

Example:

```js
const STRIPE_PAYMENT_LINKS = {
  frame: "https://buy.stripe.com/...",
  "frame+arm": "https://buy.stripe.com/...",
  "frame+arm+top-plate": "https://buy.stripe.com/..."
};
```

## GitHub Pages

1. Push these files to a GitHub repository.
2. Open `Settings` -> `Pages`.
3. Choose `Deploy from a branch`.
4. Select branch `main` and folder `/root`.

The site will be available at your GitHub Pages URL.
