# Astronomy asset provenance

The WebGL experience bundles four optimized derivatives of public NASA imagery. They are local build inputs, not
runtime hotlinks. NASA identifiers and credits are retained here so every rendered observation can be traced back to
its source.

| Local asset | Render use | Authoritative source and credit | Derived SHA-256 |
| --- | --- | --- | --- |
| `nasa-deep-star-map-2k.webp` | Distant celestial sphere and lensing background | [NASA SVS Deep Star Maps](https://svs.gsfc.nasa.gov/4851/), NASA/Goddard Space Flight Center Scientific Visualization Studio | `b413855f21f7c4d080211565b84456c7f9a46d06efb6339a13c42623894ee7ce` |
| `nasa-wise-all-sky-2k.webp` | Low-energy infrared dust structure | [Mapping the Infrared Universe: The Entire WISE Sky](https://www.jpl.nasa.gov/images/pia15482-mapping-the-infrared-universe-the-entire-wise-sky-rectangular-format/), NASA/JPL-Caltech/UCLA | `19b9ea6d3efa5ec333a0e7348019923d04bb99272cb2e0fce28841f9bfd2732e` |
| `nasa-lroc-color-2k.webp` | Lunar albedo and maria detail | [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), NASA/Goddard Space Flight Center Scientific Visualization Studio; Lunar Reconnaissance Orbiter Camera | `07d92fffaeed826fd15a58d0f9fa2d926981ea010bf45595a4b2557f7ddb807a` |
| `nasa-lola-height-1k.jpg` | Lunar vertex relief and fragment-normal detail | [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), NASA/Goddard Space Flight Center Scientific Visualization Studio; Lunar Orbiter Laser Altimeter | `6d93f887e7d8bedfe35ab89ba785e5e3ca12381bd092a5e6abe2c707dda8bb98` |

## Source files

| Source file | Source SHA-256 |
| --- | --- |
| `starmap_4k.jpg` | `0b33503895abebeb92fd89d3332e3ca62515b8cc458d243f208e4ca5d8c1452d` |
| `jpegPIA15482.jpg` | `83e6e653d8e6cac7940ad94362bd0192f02c8fb1de6b41dd4a5bf65da4443b66` |
| `lroc_color_2k.jpg` | `f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170` |
| `ldem_3_8bit.jpg` | `6d93f887e7d8bedfe35ab89ba785e5e3ca12381bd092a5e6abe2c707dda8bb98` |

The deep-star and WISE maps were resized to 2048×1024 with a Lanczos filter and encoded as WebP. The LROC map keeps
its 2048×1024 dimensions and is encoded as WebP. The 1024×512 8-bit LOLA height map is retained as the original JPEG.
No generative fill, repainting, or compositing was applied to the observation data.

NASA imagery is used in accordance with the [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
Its presence does not imply NASA endorsement. NASA, JPL, WISE, LRO, LROC, and LOLA marks are not used as site branding.
