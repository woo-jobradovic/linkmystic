// Corsair HXi / RMi power supplies: READ-ONLY monitoring. Pure packet builders + PMBus decoding.
// Facts: liquidctl corsair_hid_psu + pmbus (GPL-3.0). LinkMystic never writes OCP or fan-mode registers.

export const VID = 0x1b1c;
export const MODELS = {
  0x1c05: 'HX750i', 0x1c06: 'HX850i', 0x1c07: 'HX1000i', 0x1c08: 'HX1200i', 0x1c0a: 'RM650i', 0x1c0b: 'RM750i',
  0x1c0c: 'RM850i', 0x1c0d: 'RM1000i', 0x1c1e: 'HX1000i (2022)', 0x1c1f: 'HX1500i', 0x1c23: 'HX1200i ATX 3.1', 0x1c27: 'HX1200i ATX 3.1',
};
export const REPORT_LEN = 64;
const ADDR = 0x02, READ = 0x01, WRITE = 0x00;
export const REG = { page: 0x00, vin: 0x88, vout: 0x8b, iout: 0x8c, temp1: 0x8d, temp2: 0x8e, fan: 0x90, pout: 0x96, totalPower: 0xee };

// 65-byte output report (report id 0 + 64)
function report(bytes) { const b = new Array(1 + REPORT_LEN).fill(0); bytes.forEach((v, i) => { b[1 + i] = v; }); return b; }
export const handshake = () => report([0xfe, 0x03]);                    // makes the PSU answer with real values; changes no setting
export const readCmd = reg => report([ADDR | READ, reg]);
export const selectRail = rail => report([ADDR | WRITE, REG.page, rail]); // 0 = +12V, 1 = +5V, 2 = +3.3V (page register only)

// PMBus LINEAR11: 5-bit two's-complement exponent, 11-bit two's-complement mantissa, little endian
export function linear11(lo, hi) {
  const v = lo | (hi << 8);
  let exp = v >> 11, man = v & 0x7ff;
  if (man > 1023) man -= 2048;
  if (exp > 15) exp -= 32;
  return man * 2 ** exp;
}
