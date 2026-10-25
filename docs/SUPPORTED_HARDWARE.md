# Supported hardware

**Tested** = confirmed on real hardware by a maintainer or user. **Expected** = protocol known, not yet confirmed. Please open a *Device support* issue with your diagnostics to move a device to *tested*.

## Corsair iCUE LINK System Hub (USB 1B1C:0C3F)
| Device (hub type byte) | Lighting | Speed control | Status |
|---|---|---|---|
| TITAN 240/280/360/420 AIO (0x11), incl. RX / LCD | 20 LEDs (16 visible under an LCD cap) | pump, min 70 % | **Tested**: TITAN 360 RX LCD, hub fw 4.1.656 |
| RX RGB fan (0x0F) | 8 LEDs | yes | **Tested** |
| Pump LCD cap ring (0x06) | 24 LEDs | - | **Tested** |
| H100i/H115i/H150i/H170i AIO (0x07) | 20 LEDs | pump, min 70 % | Expected |
| QX RGB (0x01), LX RGB (0x02), RX RGB MAX (0x03) fans | 34 / 18 / 8 LEDs | yes | Expected |
| RX (0x13), RX MAX (0x04), VRM cooler (0x10) fans | - | yes | Expected |
| XD5 ELITE (0x0C), XD6 ELITE (0x19) pump/reservoirs | 22 LEDs | pump, min 70 % | Expected |
| XC7 ELITE (0x09), XG7 RGB (0x0D) blocks | 24 / 16 LEDs | - | Expected |
| 9000D / 5000T case lighting (0x05) | 22 / 160 LEDs | - | Expected |
| Unknown types | not driven | not driven | listed in diagnostics |

## Corsair iCUE LINK pump LCD (USB 1B1C:0C4E)
480x480 JPEG frames. **Tested** on the TITAN 360 RX LCD; about 20 frames per second (USB limit).

## MSI "761" lighting controller (USB 0DB0:0076)
Headers JARGB1, JARGB2, JARGB3 and JAF; up to 240 LEDs each. LinkMystic writes **only** when Windows reports one of these boards:

MAG X870 TOMAHAWK WIFI (MS-7E51) · MAG B850M MORTAR WIFI (MS-7E61) · MPG B850I EDGE TI WIFI (MS-7E79) · X870 GAMING PLUS WIFI (MS-7E47) · B850 GAMING PLUS WIFI6E (MS-7E80) · B850M GAMING PLUS WIFI6E (MS-7E81) · MPG X870E CARBON WIFI (MS-7E49) · Z890 GAMING PLUS WIFI (MS-7E34) · X870E GAMING PLUS WIFI (MS-7E70) · **MAG X870E TOMAHAWK WIFI (MS-7E59), tested** · PRO B850-P WIFI (MS-7E56) · B850M GAMING PLUS WIFI (MS-7E66) · PRO X870E-P WIFI (MS-7E70) · MPG X870I EDGE TI EVO WIFI (MS-7E50) · B850 GAMING PLUS WIFI (MS-7E56) · PRO X870-P WIFI (MS-7E47) · MPG X870E EDGE TI WIFI (MS-7E59) · MAG B850 TOMAHAWK MAX WIFI (MS-7E62) · PRO B850M-P WIFI (MS-7E71) · MAG Z890 TOMAHAWK WIFI (MS-7E32) · MPG B850 EDGE TI WIFI (MS-7E62) · PRO B850M-VC WIFI6E (MS-7E71) · MAG B850 TOMAHAWK WIFI (MS-7E53) · MEG Z890 UNIFY-X (MS-7E20) · PRO X870E-S EVO WIFI (MS-7E86) · MAG X870E GAMING MAX WIFI (MS-7E86) · PRO Z890-P WIFI (MS-7E34) · B850 GAMING PLUS WIFI PZ (MS-7E75) · MAG X870E TOMAHAWK MAX WIFI PZ (MS-7E84) · PRO B850M-A WIFI PZ (MS-7E78) · B850MPOWER (MS-7E83) · B840M GAMING WIFI6E (MS-7E76) · PRO B850M-A WIFI (MS-7E66) · PRO B850-S WIFI6E (MS-7E80) · B850M GAMING WIFI (MS-7E82)

Limits: about 10 direct updates per second in total (761-byte USB control transfers); onboard LEDs, JRGB (12 V) and JPIPE are not driven in v0.1. Older MSI boards use different protocols and are never written to.

## Corsair HXi / RMi power supplies (read-only)
HX750i, HX850i, HX1000i, HX1000i (2022), HX1200i, HX1200i ATX 3.1, **HX1500i (tested)**, RM650i, RM750i, RM850i, RM1000i. LinkMystic only reads values; it never writes OCP or fan-mode settings.
