# Image Router

Koa router that helps to serve responsive images in an SSR app

## `KoaResponsiveImageRouter.image()` arguments

- **target_ratio** - ratio (width divided by height) of an image container.
- **ratio_diff_threshold** - describes how much ratio of an image can differ from `target_ratio` until `ratio-crossed-threshold` class is added to the image

Both are used to add useful classes to `<img>` element. See `<img>` Element classes

## `<img>` Element classes

These help to avoid situations like stripes or uneven whitespace around the image and excessive clipping of images. It is done by setting `object-fit` values in CSS depending on these classes.

- **horizontal** / **landscape** - added when image width is greater than height
- **vertical** / **portrait** - if image height is greater
- **square** - when both dimensions are the same
- **ratio-crossed-threshold** - if image ratio differs by at least `ratio_diff_threshold` from `target_ratio` (both are `KoaResponsiveImageRouter.image()` optional arguments)
- **ratio-above-threshold** or **ratio-below-threshold** - added together with `ratio-crossed-threshold` depending if image ratio is above or below `target_ratio`

## Image Cropping Options

The `image()` function accepts a `crop` parameter that allows you to specify cropping options for the displayed image.
Use the `crop` parameter to control how the image is cropped or displayed within the specified dimensions, with consideration for the **SmartCrop** algorithm.

`crop`: An object representing cropping options. It can have the following properties:
  - `width`: The target width for the cropped image. This parameter is used to specify the desired width of the cropped image when using the **SmartCrop** algorithm.
  - `height`: The target height for the cropped image. This parameter is used to specify the desired height of the cropped image when using the **SmartCrop** algorithm.
  - `x` **(optional)**: The horizontal offset from the left edge of the image. This parameter is used for direct cropping to determine the starting point for cropping horizontally.
  - `y` **(optional)**:  The vertical offset from the top edge of the image. This parameter is used for direct cropping to determine the starting point for cropping vertically..

### Example Usage

Here are some examples of how to use the `crop` parameter in the `image()` function:

#### 1. Cropping with SmartCrop Algorithm:

```typescript
${await imageRouter.image({
    resolutions: [600, 1000, 1500, 2000],
    sizes_attr: "(max-width: 600) 100vw, 600px",
    path: paths.exampleSmartCropImg,
    lazy: false,
    img_style: "width: 600px; height: auto",
    crop: { width: 600, height: 600 },
})}
```

This example utilizes the **SmartCrop** algorithm to crop the image to a specific `width` and `height`.

#### 2. Direct Cropping with Coordinates:

```typescript
${await imageRouter.image({
    resolutions: [600, 1000, 1500, 2000],
    sizes_attr: "(max-width: 600px) 100vw, 600px",
    path: paths.exampleSmartCropImg,
    lazy: false,
    img_style: "width: 600px; height: auto",
    crop: { width: 2592, height: 3456, x: 2592, y: 0 },
})}
```

In this example, direct cropping is applied with specific `x` and `y` coordinates.

#### 3. Default without cropping

```typescript
${await imageRouter.image({
    resolutions: [600, 1000, 1500, 2000],
    sizes_attr: "(max-width: 600) 100vw, 600px",
    path: paths.exampleSmartCropImg,
    lazy: false,
    img_style: "width: 600px; height: auto",
})}
```

When no crop parameter is provided, the image is displayed without cropping.


