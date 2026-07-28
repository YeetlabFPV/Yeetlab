# Yeetlab Shreddo 5 Website

Static product page for GitHub Pages with Stripe Checkout powered by a small
Cloudflare Worker.

## Customize content

- `index.html`: product copy, contact email, product names
- `styles.css`: visual design
- `script.js`: browser quantity handling and checkout request
- `checkout-worker.js`: secure Stripe Checkout Session creation
- `wrangler.jsonc`: Cloudflare Worker configuration
- `assets/`: logo and product images

## Adding future product images

Add the image file to `assets/`, then add another thumbnail button in the
`product-gallery` block in `index.html` with `data-gallery-src` pointing to the
new file. The main gallery image will switch automatically.

## Stripe setup

This is a static GitHub Pages site, so it cannot securely create dynamic Stripe
Checkout sessions on its own. Checkout sessions are created by the
`yeetlab-checkout` Cloudflare Worker.

The frontend sends only spare-part product keys and quantities to:

```txt
https://yeetlab-checkout.tmw-fpv.workers.dev/checkout
```

Stripe Price IDs and the shipping rate are mapped server-side in
`checkout-worker.js`. The Stripe secret must remain in the Cloudflare Worker
environment variable `STRIPE_SECRET_KEY`.

```sh
npm install
npm run check
npm run deploy
```

## GitHub Pages

1. Push these files to a GitHub repository.
2. Open `Settings` -> `Pages`.
3. Choose `Deploy from a branch`.
4. Select branch `main` and folder `/root`.

The site will be available at your GitHub Pages URL.
