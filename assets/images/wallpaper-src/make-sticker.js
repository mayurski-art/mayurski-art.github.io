const sharp = require('sharp');

(async () => {
  // Start from the trimmed content, add a little even white padding so the
  // die-cut border doesn't hug the linework too tightly, then round the
  // corners like a real vinyl sticker and add a soft drop shadow.
  const pad = 60;
  const trimmed = sharp('sticker-trimmed.png');
  const meta = await trimmed.metadata();
  const w = meta.width + pad * 2;
  const h = meta.height + pad * 2;

  const padded = await sharp('sticker-trimmed.png')
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
    .png()
    .toBuffer();

  const radius = 70;
  const roundedMask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );

  const stickerRounded = await sharp(padded)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Drop shadow: blurred black silhouette of the same rounded shape, offset
  // slightly, composited underneath the sticker.
  const shadowShape = await sharp(roundedMask)
    .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#000"/></svg>`) }])
    .blur(18)
    .png()
    .toBuffer();

  const canvasW = w + 80;
  const canvasH = h + 80;
  const final = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadowShape, left: 40 + 10, top: 40 + 14, blend: 'over' },
      { input: stickerRounded, left: 40, top: 40, blend: 'over' },
    ])
    .png()
    .toFile('obj-stickers-real.png');

  console.log('done', canvasW, canvasH);
})();
