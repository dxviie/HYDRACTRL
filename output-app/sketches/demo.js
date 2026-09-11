// Demo sketch for the output spike. Audio-reactive: make some noise near the mic
// and the modulation depth follows a.fft[0].
osc(10, 0.1, 1.2)
  .color(0.5, 0.1, 0.9)
  .rotate(0, 0.1)
  .modulateScale(osc(3, 0.2), () => 0.5 + a.fft[0])
  .out();
