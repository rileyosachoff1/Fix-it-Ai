export async function diagnose({
  description,           // primary audio analysis text (required)
  duration,
  vehicleInfo,           // { year, make, model } | undefined
  vehicleSpecs,          // specs object from data/vehicleSpecs.js | undefined
  odometerKm,            // current odometer in km | undefined
  lastOilChangeKm,       // odometer at last oil change (km) | undefined
  textDescription,       // driver's text | undefined
  images,                // [{ base64, mediaType }] | undefined
  videoFrames,           // [base64 string] | undefined
  additionalRecordings,  // [{ label, description, duration }] | undefined
  obd2Data,              // { sensors: {...}, faultCodes: [...] } | undefined
}) {
  const body = { description, duration };

  if (vehicleInfo?.make)            body.vehicleInfo           = vehicleInfo;
  if (vehicleSpecs)                 body.vehicleSpecs          = vehicleSpecs;
  if (odometerKm)                   body.odometerKm            = odometerKm;
  if (lastOilChangeKm != null)      body.lastOilChangeKm       = lastOilChangeKm;
  if (textDescription?.trim())      body.textDescription       = textDescription.trim();
  if (images?.length)               body.images                = images;
  if (videoFrames?.length)          body.videoFrames           = videoFrames;
  if (additionalRecordings?.length) body.additionalRecordings  = additionalRecordings;
  if (obd2Data?.sensors)            body.obd2Data              = obd2Data;

  const res = await fetch('/api/diagnose', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data.result;
}
