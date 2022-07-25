# Image Router

Koa router that helps to serve responsive images in an SSR app

### 1. `KoaResponsiveImageRouter.image()` arguments

- **target_ratio** - ratio (width divided by height) of an image container.
- **ratio_diff_threshold** - describes how much ratio of an image can differ from `target_ratio` until `ratio-crossed-threshold` class is added to the image

Both are used to add useful classes to `<img>` element. See `<img>` Element classes

### 2. `<img>` Element classes

These help to avoid situations like stripes or uneven whitespace around the image and excessive clipping of images. It is done by setting `object-fit` values in CSS depending on these classes.

- **horizontal** / **landscape** - added when image width is greater than height
- **vertical** / **portrait** - if image height is greater
- **square** - when both dimensions are the same
- **ratio-crossed-threshold** - if image ratio differs by at least `ratio_diff_threshold` from `target_ratio` (both are `KoaResponsiveImageRouter.image()` optional arguments)
- **ratio-above-threshold** or **ratio-below-threshold** - added together with `ratio-crossed-threshold` depending if image ratio is above or below `target_ratio` 