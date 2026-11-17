import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { AvatarConfig, Measurement } from '../db/types';
import type { BodyParams } from '../components/Body3D';

/**
 * Parametri del manichino. Se "usa misurazioni" è attivo, le circonferenze REALI più recenti
 * sostituiscono i valori di partenza; i valori non misurati derivano da proporzioni standard
 * dell'altezza moltiplicate per i cursori impostati dall'utente.
 */
export function bodyParamsFrom(a: AvatarConfig, measurements: Measurement[]): { params: BodyParams; measured: string[] } {
  const h = a.heightCm;
  const latest = (k: keyof Measurement) => {
    const m = measurements.filter((x) => typeof x[k] === 'number').sort((x, y) => y.date.localeCompare(x.date))[0];
    return m ? (m[k] as number) : undefined;
  };
  const measured: string[] = [];
  const pick = (k: keyof Measurement, fallback: number, label: string) => {
    const v = a.useMeasurements ? latest(k) : undefined;
    if (v) { measured.push(label); return v; }
    return fallback;
  };
  const buildF = 0.85 + a.build * 0.3;
  const armR = latest('armR'); const armL = latest('armL');
  const thighR = latest('thighR'); const thighL = latest('thighL');
  const armMeasured = a.useMeasurements && (armR || armL) ? ((armR ?? armL!) + (armL ?? armR!)) / 2 : undefined;
  const thighMeasured = a.useMeasurements && (thighR || thighL) ? ((thighR ?? thighL!) + (thighL ?? thighR!)) / 2 : undefined;
  if (armMeasured) measured.push('braccia');
  if (thighMeasured) measured.push('cosce');
  return {
    measured,
    params: {
      heightCm: h,
      chestCm: pick('chest', h * 0.57 * buildF * a.chest, 'torace'),
      waistCm: pick('waist', h * 0.52 * buildF * a.waist, 'girovita'),
      hipsCm: pick('hips', h * 0.56 * buildF * a.hips, 'fianchi'),
      armCm: armMeasured ?? h * 0.19 * buildF * a.arms,
      thighCm: thighMeasured ?? h * 0.32 * buildF * a.legs,
      calfCm: pick('calf', h * 0.21 * buildF * a.legs, 'polpaccio'),
      shoulders: a.shoulders,
      skinTone: a.skinTone
    }
  };
}

export function useBodyParams() {
  return useLiveQuery(async () => {
    const a = await db.avatar.get('avatar');
    const ms = await db.measurements.toArray();
    if (!a) return undefined;
    return { avatar: a, ...bodyParamsFrom(a, ms) };
  }, []);
}
