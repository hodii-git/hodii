# Components

- Listing card rows use the `.card-grid` class in styles.css, never Tailwind `min-[…]` or custom `--breakpoint-*` variants: those media blocks are emitted before the named breakpoints, so `lg:grid-cols-4` wins and wider rows never show.
