/**
 * Form coaching for the bundled exercise library.
 *
 * Bundled rather than fetched: the gym is exactly where signal dies, and a cue
 * you cannot load between sets is worthless. Advice is deliberately
 * conservative and standard — the app is a tracker, not a physiotherapist, and
 * the health disclaimer stands.
 */
export interface Mistake {
  wrong: string;
  fix: string;
}

export interface ExerciseCoaching {
  /** Getting into position, before the first rep. */
  setup: string[];
  /** What to do during the rep. */
  execution: string[];
  /** The errors that actually show up on a gym floor. */
  mistakes: Mistake[];
  breathing: string;
}

const COACHING: Record<string, ExerciseCoaching> = {
  "bench-press": {
    setup: [
      "Eyes under the bar, shoulder blades pulled together and down into the bench.",
      "Feet flat and planted, a slight natural arch in the lower back.",
      "Grip just wider than shoulder width, bar stacked over your wrists.",
    ],
    execution: [
      "Lower under control to the lower chest, elbows tucked to roughly 45°.",
      "Touch the chest without bouncing, then drive the bar back over the shoulders.",
      "Keep the shoulder blades pinned throughout — they do not travel with the bar.",
    ],
    mistakes: [
      { wrong: "Elbows flared straight out to the sides", fix: "Tuck to about 45° to spare the shoulder joint." },
      { wrong: "Hips lifting off the bench to grind a rep", fix: "Drop the weight — the rep no longer counts as a bench press." },
    ],
    breathing: "Breathe in at the top, hold through the descent, breathe out as you press.",
  },
  "incline-db-press": {
    setup: [
      "Bench at 30°; steeper turns it into a shoulder press.",
      "Kick the dumbbells up with your knees, shoulder blades set back.",
      "Start with the bells just outside the shoulders.",
    ],
    execution: [
      "Lower until the elbows are level with the torso, no deeper.",
      "Press up and slightly inward, stopping short of clashing the bells.",
      "Control the descent — the stretch is where the chest works.",
    ],
    mistakes: [
      { wrong: "Bench set near vertical", fix: "30° keeps the load on the upper chest instead of the front delts." },
      { wrong: "Bouncing the bells together at the top", fix: "Stop a few inches apart and keep tension." },
    ],
    breathing: "In on the way down, out as you press.",
  },
  "cable-fly": {
    setup: [
      "Set the pulleys at or just above shoulder height.",
      "Split stance, chest up, a soft unlocked bend in the elbows.",
      "Step forward until you feel tension before the first rep.",
    ],
    execution: [
      "Sweep the handles together in an arc, like hugging a barrel.",
      "Hold the squeeze briefly at the front, elbows fixed at the same angle.",
      "Open back out until you feel a stretch across the chest, not the shoulder.",
    ],
    mistakes: [
      { wrong: "Bending and straightening the elbows", fix: "That turns it into a press — keep the elbow angle locked." },
      { wrong: "Going so heavy the shoulders roll forward", fix: "Lighten it; this is an isolation movement." },
    ],
    breathing: "Out as the handles come together, in as they open.",
  },
  dips: {
    setup: [
      "Grip the bars, arms locked, shoulders pulled down away from the ears.",
      "Lean the torso forward slightly for chest, stay upright for triceps.",
      "Brace the core so the legs do not swing.",
    ],
    execution: [
      "Lower until the upper arms are roughly parallel to the floor.",
      "Stop if the shoulders start rolling forward — that is your depth.",
      "Press back up without locking out aggressively.",
    ],
    mistakes: [
      { wrong: "Dropping as deep as the shoulders allow", fix: "Depth past parallel adds shoulder strain, not chest." },
      { wrong: "Swinging the legs to generate momentum", fix: "Cross the ankles and keep them still." },
    ],
    breathing: "In on the descent, out as you press up.",
  },
  "push-ups": {
    setup: [
      "Hands under the shoulders, or slightly wider.",
      "Body in one straight line from head to heels.",
      "Squeeze the glutes and brace the stomach before the first rep.",
    ],
    execution: [
      "Lower the chest toward the floor, elbows at about 45°.",
      "Touch lightly, then push the floor away.",
      "Keep the hips travelling at the same speed as the chest.",
    ],
    mistakes: [
      { wrong: "Hips sagging or piking up", fix: "Brace harder, or drop to your knees to keep the line." },
      { wrong: "Only going halfway down", fix: "Reduce reps and take the full range instead." },
    ],
    breathing: "In on the way down, out on the way up.",
  },
  "close-grip-push-up": {
    setup: [
      "Hands under the chest, roughly shoulder width or slightly narrower.",
      "Straight line from head to heels, core braced.",
      "Elbows pointed back, not out.",
    ],
    execution: [
      "Lower with the elbows brushing past the ribs.",
      "Touch the chest down near the hands.",
      "Press up and think about squeezing the triceps at the top.",
    ],
    mistakes: [
      { wrong: "Hands so close the wrists complain", fix: "Shoulder width is close enough for the triceps." },
      { wrong: "Elbows flaring out wide", fix: "Keep them tracking backwards along the body." },
    ],
    breathing: "In down, out up.",
  },
  deadlift: {
    setup: [
      "Bar over mid-foot, shins almost touching it.",
      "Grip just outside the knees, then pull the chest up and the hips down.",
      "Take the slack out of the bar before you pull — you should hear it click.",
    ],
    execution: [
      "Push the floor away rather than yanking the bar up.",
      "Keep the bar dragging up the legs, back flat throughout.",
      "Finish standing tall — do not lean back at the top.",
    ],
    mistakes: [
      { wrong: "Hips shooting up first, leaving the back to lift", fix: "Hips and shoulders should rise together." },
      { wrong: "Rounding the lower back under load", fix: "Lower the weight until you can hold a flat back." },
    ],
    breathing: "Big breath in and brace before the pull, out at the top.",
  },
  "pull-ups": {
    setup: [
      "Grip slightly wider than shoulders, hands over the bar.",
      "Start from a dead hang with the shoulders pulled down.",
      "Brace the core and cross the ankles.",
    ],
    execution: [
      "Lead with the elbows driving down toward the ribs.",
      "Pull until the chin clears the bar, chest toward it.",
      "Lower under control all the way back to the hang.",
    ],
    mistakes: [
      { wrong: "Kipping and swinging to get the chin up", fix: "Use a band or negatives instead — the rep should be strict." },
      { wrong: "Stopping halfway down between reps", fix: "Full hang each rep, or you are training half a range." },
    ],
    breathing: "Out as you pull, in as you lower.",
  },
  "lat-pulldown": {
    setup: [
      "Set the thigh pad so you are anchored and cannot lift off.",
      "Grip wider than shoulders, sit tall, slight lean back.",
      "Pull the shoulders down before the arms do anything.",
    ],
    execution: [
      "Drive the elbows down and back toward the pockets.",
      "Bring the bar to the upper chest, not behind the neck.",
      "Let the bar rise fully and feel the lats stretch.",
    ],
    mistakes: [
      { wrong: "Pulling the bar behind the neck", fix: "Front of the chest — behind the neck stresses the shoulder for nothing." },
      { wrong: "Leaning far back and rowing it", fix: "Keep the torso mostly upright and let the lats work." },
    ],
    breathing: "Out as you pull down, in as it returns.",
  },
  "seated-row": {
    setup: [
      "Feet planted, knees slightly bent, chest up.",
      "Sit tall with the arms extended and the lats already under tension.",
      "Neutral spine — no slumping toward the machine.",
    ],
    execution: [
      "Pull the handle to the stomach, elbows close to the body.",
      "Squeeze the shoulder blades together at the end of the pull.",
      "Return under control until the arms are straight.",
    ],
    mistakes: [
      { wrong: "Rocking the torso back and forth", fix: "Lock the torso and move only the arms." },
      { wrong: "Shrugging the weight up", fix: "Keep the shoulders down and pull with the back." },
    ],
    breathing: "Out on the pull, in on the return.",
  },
  "face-pull": {
    setup: [
      "Rope attachment set at roughly face height.",
      "Step back until the cable is taut with the arms extended.",
      "Split stance, chest tall.",
    ],
    execution: [
      "Pull the rope toward the forehead, hands separating as you go.",
      "Finish with the elbows high and the hands beside the ears.",
      "Hold for a beat before returning — this one is about control, not load.",
    ],
    mistakes: [
      { wrong: "Going heavy and turning it into a row", fix: "Light weight, high elbows — it is for the rear delts." },
      { wrong: "Elbows dropping toward the floor", fix: "Keep them level with the shoulders." },
    ],
    breathing: "Out as you pull, in as you release.",
  },
  "inverted-row": {
    setup: [
      "Bar set around hip height, hang underneath it.",
      "Body straight from head to heels, heels on the floor.",
      "Grip slightly wider than the shoulders.",
    ],
    execution: [
      "Pull the chest to the bar, elbows tracking back.",
      "Squeeze the shoulder blades at the top.",
      "Lower until the arms are straight, holding the body line.",
    ],
    mistakes: [
      { wrong: "Hips sagging toward the floor", fix: "Squeeze the glutes and keep one straight line." },
      { wrong: "Only pulling halfway", fix: "Raise the bar to make it easier and take the full range." },
    ],
    breathing: "Out as you pull, in as you lower.",
  },
  superman: {
    setup: [
      "Lie face down, arms extended overhead.",
      "Neck neutral — look at the floor, not forward.",
      "Legs straight and together.",
    ],
    execution: [
      "Lift the arms, chest and legs a few inches off the floor.",
      "Hold briefly, squeezing the lower back and glutes.",
      "Lower everything under control.",
    ],
    mistakes: [
      { wrong: "Cranking the neck up to look ahead", fix: "Keep the chin tucked and the neck in line." },
      { wrong: "Bouncing the reps", fix: "Slow lift, brief hold, slow lower." },
    ],
    breathing: "Out as you lift, in as you lower.",
  },
  squat: {
    setup: [
      "Bar on the upper back, not the neck; hands pull it tight into the traps.",
      "Feet shoulder width, toes turned slightly out.",
      "Big breath into the stomach and brace before unracking.",
    ],
    execution: [
      "Break at the hips and knees together, sitting between the feet.",
      "Descend until the hip crease passes the knee, if your mobility allows.",
      "Drive up through the whole foot, knees tracking over the toes.",
    ],
    mistakes: [
      { wrong: "Knees caving inward on the way up", fix: "Push the knees out in line with the toes." },
      { wrong: "Heels lifting off the floor", fix: "Widen the stance slightly or work on ankle mobility." },
    ],
    breathing: "In and brace at the top, out as you pass the hardest point.",
  },
  rdl: {
    setup: [
      "Stand tall holding the bar at the hips, feet hip width.",
      "Soft bend in the knees — it stays the same all the way down.",
      "Shoulders back, bar close to the thighs.",
    ],
    execution: [
      "Push the hips back and let the bar slide down the legs.",
      "Stop when you feel a strong hamstring stretch, usually mid-shin.",
      "Drive the hips forward to stand, squeezing the glutes at the top.",
    ],
    mistakes: [
      { wrong: "Squatting it down by bending the knees", fix: "The hips travel backwards; the knees barely move." },
      { wrong: "Letting the bar drift away from the legs", fix: "Keep it brushing the thighs the whole way." },
    ],
    breathing: "In at the top, hold on the way down, out as you stand.",
  },
  "leg-press": {
    setup: [
      "Feet shoulder width, mid-platform, whole foot in contact.",
      "Lower back and hips flat against the pad.",
      "Release the safeties and take the weight under control.",
    ],
    execution: [
      "Lower until the knees reach roughly 90°.",
      "Stop before the hips start curling off the pad.",
      "Press through the whole foot without snapping the knees straight.",
    ],
    mistakes: [
      { wrong: "Lowering so far the lower back rounds off the pad", fix: "Shorten the range — that curl is where backs get hurt." },
      { wrong: "Locking the knees hard at the top", fix: "Stop just short and keep tension on the muscle." },
    ],
    breathing: "In as it comes down, out as you press.",
  },
  lunges: {
    setup: [
      "Stand tall, weights at your sides, core braced.",
      "Clear space ahead so you can walk in a straight line.",
      "Eyes forward, chest up.",
    ],
    execution: [
      "Step forward and lower until the back knee is just above the floor.",
      "Keep the front shin close to vertical.",
      "Drive through the front heel to step into the next rep.",
    ],
    mistakes: [
      { wrong: "Front knee sliding far past the toes", fix: "Take a longer step so the shin stays upright." },
      { wrong: "Torso pitching forward", fix: "Stay tall and brace — lighten the load if you cannot." },
    ],
    breathing: "In as you descend, out as you drive up.",
  },
  "leg-curl": {
    setup: [
      "Pad sits just above the heels, knees at the machine's pivot.",
      "Hips flat on the bench, hands holding the grips.",
      "Legs straight but not locked to start.",
    ],
    execution: [
      "Curl the heels toward the glutes with a smooth pull.",
      "Squeeze at the top for a beat.",
      "Lower slowly — the negative is most of the work.",
    ],
    mistakes: [
      { wrong: "Hips lifting off the pad to move the weight", fix: "Lighten it and keep the hips pinned down." },
      { wrong: "Letting the weight drop back to the stack", fix: "Control the return; do not just release." },
    ],
    breathing: "Out as you curl, in as you lower.",
  },
  "goblet-squat": {
    setup: [
      "Hold a dumbbell or kettlebell at chest height, elbows tucked under it.",
      "Feet shoulder width, toes slightly out.",
      "Chest up, weight acting as a counterbalance.",
    ],
    execution: [
      "Sit straight down between the feet.",
      "Let the elbows track inside the knees at the bottom.",
      "Stand by driving through the whole foot.",
    ],
    mistakes: [
      { wrong: "Weight drifting away from the chest", fix: "Keep it pinned close or the lower back takes the load." },
      { wrong: "Rounding forward at the bottom", fix: "Reduce depth to where you can hold a tall chest." },
    ],
    breathing: "In at the top, out as you stand.",
  },
  "bodyweight-squat": {
    setup: ["Feet shoulder width, toes slightly out.", "Arms out in front for balance.", "Chest up, core braced."],
    execution: [
      "Sit the hips back and down.",
      "Go as deep as you can with the heels down and the back flat.",
      "Stand by squeezing the glutes at the top.",
    ],
    mistakes: [
      { wrong: "Heels lifting", fix: "Widen the stance a little or reduce depth." },
      { wrong: "Rushing the reps", fix: "Slow the descent — tempo is the only load you have here." },
    ],
    breathing: "In down, out up.",
  },
  "split-squat": {
    setup: [
      "Long stride, front foot flat, back heel raised.",
      "Torso tall, weight mostly on the front leg.",
      "Hold a rail for balance while you learn it.",
    ],
    execution: [
      "Drop the back knee straight down toward the floor.",
      "Stop just short of touching down.",
      "Drive up through the front heel without pushing off the back toe.",
    ],
    mistakes: [
      { wrong: "Stance too short, so the front knee shoots forward", fix: "Step further out and keep the shin upright." },
      { wrong: "Pushing off the back foot", fix: "The back leg balances; the front leg lifts." },
    ],
    breathing: "In as you lower, out as you drive up.",
  },
  "glute-bridge": {
    setup: [
      "Lie on your back, knees bent, heels close to the glutes.",
      "Feet hip width, arms flat at your sides.",
      "Tuck the ribs down so the lower back is not arched.",
    ],
    execution: [
      "Push through the heels and lift the hips until the body is a straight line.",
      "Squeeze the glutes hard at the top for a beat.",
      "Lower under control without resting between reps.",
    ],
    mistakes: [
      { wrong: "Arching the lower back to get higher", fix: "The height comes from the glutes, not the spine." },
      { wrong: "Pushing through the toes", fix: "Drive through the heels." },
    ],
    breathing: "Out as you lift, in as you lower.",
  },
  "calf-raise": {
    setup: [
      "Balls of the feet on the step, heels hanging free.",
      "Stand tall, legs straight but not locked.",
      "Hold something for balance.",
    ],
    execution: [
      "Rise as high onto the toes as you can.",
      "Pause at the top — calves respond to the squeeze.",
      "Lower slowly until you feel a full stretch.",
    ],
    mistakes: [
      { wrong: "Bouncing on the tendon", fix: "Slow and controlled at both ends." },
      { wrong: "Cutting the range short", fix: "Full stretch at the bottom, full rise at the top." },
    ],
    breathing: "Out as you rise, in as you lower.",
  },
  ohp: {
    setup: [
      "Bar on the front shoulders, hands just outside shoulder width.",
      "Elbows slightly in front of the bar, wrists stacked.",
      "Squeeze the glutes and brace so the ribs do not flare.",
    ],
    execution: [
      "Move the head back slightly and press the bar in a straight line.",
      "Push the head 'through the window' once the bar clears it.",
      "Finish with the bar over the mid-foot, arms locked.",
    ],
    mistakes: [
      { wrong: "Leaning back and turning it into an incline press", fix: "Brace the core and squeeze the glutes to stay upright." },
      { wrong: "Pressing around the face in an arc", fix: "Tilt the head back out of the way and press straight." },
    ],
    breathing: "In and brace at the bottom, out at the top.",
  },
  "lateral-raise": {
    setup: [
      "Light dumbbells — this muscle does not need load, it needs tension.",
      "Stand tall, slight bend in the elbows.",
      "Bells just in front of the thighs.",
    ],
    execution: [
      "Raise out to the sides until the arms reach shoulder height.",
      "Lead with the elbows, not the hands.",
      "Lower slowly — resist the whole way down.",
    ],
    mistakes: [
      { wrong: "Swinging the weight up with the hips", fix: "Halve the weight and stop the momentum." },
      { wrong: "Raising above shoulder height", fix: "Stop level — higher hands over to the traps." },
    ],
    breathing: "Out as you raise, in as you lower.",
  },
  "front-raise": {
    setup: ["Light dumbbells at the thighs.", "Stand tall, core braced.", "Soft bend in the elbows."],
    execution: [
      "Raise the weights forward to shoulder height.",
      "Keep the palms facing down or slightly in.",
      "Lower under control without swinging.",
    ],
    mistakes: [
      { wrong: "Rocking backwards to launch the weight", fix: "Brace and go lighter." },
      { wrong: "Going far above shoulder height", fix: "Stop at shoulder level." },
    ],
    breathing: "Out as you raise, in as you lower.",
  },
  "rear-delt-fly": {
    setup: [
      "Hinge forward at the hips until the torso is near parallel to the floor.",
      "Light dumbbells hanging under the chest, elbows slightly bent.",
      "Flat back, neck in line.",
    ],
    execution: [
      "Sweep the arms out to the sides, leading with the elbows.",
      "Squeeze the rear delts and upper back at the top.",
      "Lower slowly back under the chest.",
    ],
    mistakes: [
      { wrong: "Standing too upright, turning it into a lateral raise", fix: "Hinge further forward." },
      { wrong: "Heaving the weight with the lower back", fix: "Lighten it — this is a small muscle." },
    ],
    breathing: "Out as you open, in as you return.",
  },
  "pike-push-up": {
    setup: [
      "Hands on the floor, hips high, body in an upside-down V.",
      "Walk the feet in to make it harder.",
      "Head between the arms, neck relaxed.",
    ],
    execution: [
      "Lower the crown of the head toward the floor.",
      "Elbows track back and slightly out.",
      "Press back up until the arms are straight.",
    ],
    mistakes: [
      { wrong: "Hips dropping so it becomes a push-up", fix: "Keep the hips stacked high over the hands." },
      { wrong: "Crashing the head into the floor", fix: "Control the descent and stop just short." },
    ],
    breathing: "In down, out up.",
  },
  "barbell-curl": {
    setup: [
      "Shoulder-width grip, bar at the thighs.",
      "Elbows pinned at the sides, shoulders back.",
      "Stand tall with the core braced.",
    ],
    execution: [
      "Curl the bar up by bending only at the elbow.",
      "Squeeze at the top without swinging the elbows forward.",
      "Lower slowly to a full stretch.",
    ],
    mistakes: [
      { wrong: "Swinging the hips to launch the bar", fix: "If you have to cheat it up, the weight is wrong." },
      { wrong: "Elbows drifting forward at the top", fix: "Keep them locked to the ribs." },
    ],
    breathing: "Out as you curl, in as you lower.",
  },
  "hammer-curl": {
    setup: [
      "Dumbbells at your sides, palms facing in.",
      "Elbows tucked, shoulders back.",
      "Stand tall, core braced.",
    ],
    execution: [
      "Curl straight up keeping the palms facing each other.",
      "Stop when the forearm is vertical.",
      "Lower under control to a full stretch.",
    ],
    mistakes: [
      { wrong: "Rotating the wrists on the way up", fix: "The neutral grip is the point — keep it." },
      { wrong: "Using the shoulders to swing", fix: "Pin the elbows and lighten the load." },
    ],
    breathing: "Out up, in down.",
  },
  "skull-crushers": {
    setup: [
      "Lie on a bench holding the bar over the chest, arms straight.",
      "Grip about shoulder width, elbows pointing at the ceiling.",
      "Feet planted, core braced.",
    ],
    execution: [
      "Bend only at the elbow, lowering the bar toward the forehead or just behind it.",
      "Keep the upper arms still throughout.",
      "Press back up until the arms are straight.",
    ],
    mistakes: [
      { wrong: "Upper arms swinging back and forth", fix: "Only the forearm moves — that is the whole exercise." },
      { wrong: "Elbows flaring wide", fix: "Keep them pointing up and roughly shoulder width." },
    ],
    breathing: "In as it lowers, out as you press.",
  },
  "tricep-pushdown": {
    setup: [
      "Cable set high, elbows tucked at your sides.",
      "Stand slightly back from the stack, small forward lean.",
      "Grip the bar or rope with the forearms parallel to the floor.",
    ],
    execution: [
      "Push down by straightening the elbow only.",
      "Squeeze at the bottom with the arms fully extended.",
      "Let it return until the forearms are parallel again — no higher.",
    ],
    mistakes: [
      { wrong: "Elbows drifting away from the body", fix: "Pin them to the ribs the whole set." },
      { wrong: "Leaning over the bar to push with bodyweight", fix: "Stay upright and reduce the weight." },
    ],
    breathing: "Out as you push down, in as it returns.",
  },
  plank: {
    setup: [
      "Elbows under the shoulders, forearms flat.",
      "Feet hip width, body in one straight line.",
      "Tuck the ribs down and squeeze the glutes.",
    ],
    execution: [
      "Hold the line, breathing normally.",
      "Pull the elbows toward the toes without moving them, to raise tension.",
      "Stop the set when the hips start to sag — not when the clock says so.",
    ],
    mistakes: [
      { wrong: "Hips sagging toward the floor", fix: "End the set; holding a broken position trains nothing." },
      { wrong: "Holding the breath", fix: "Breathe steadily throughout." },
    ],
    breathing: "Steady breathing throughout — never hold it.",
  },
  "hanging-leg-raise": {
    setup: [
      "Hang from the bar, shoulders pulled down away from the ears.",
      "Legs together, body still before the first rep.",
      "Brace the stomach.",
    ],
    execution: [
      "Curl the pelvis up as you raise the legs — the tilt is what works the abs.",
      "Raise to at least hip height, higher if you can hold the position.",
      "Lower slowly without letting the body swing.",
    ],
    mistakes: [
      { wrong: "Swinging back and forth between reps", fix: "Pause at the bottom and reset each rep." },
      { wrong: "Only lifting the legs from the hip", fix: "Curl the pelvis up too, or the abs barely work." },
    ],
    breathing: "Out as you raise, in as you lower.",
  },
  "cable-crunch": {
    setup: [
      "Kneel below a high cable, rope beside the head.",
      "Hips stay fixed — they do not travel during the set.",
      "Start with a tall spine under tension.",
    ],
    execution: [
      "Crunch by rounding the spine down toward the knees.",
      "Squeeze the abs hard at the bottom.",
      "Return by uncurling under control.",
    ],
    mistakes: [
      { wrong: "Hinging at the hips like a bow", fix: "Round the spine — the hips stay put." },
      { wrong: "Pulling with the arms", fix: "The arms just anchor the rope; the abs move the weight." },
    ],
    breathing: "Out as you crunch, in as you rise.",
  },
  "ab-wheel": {
    setup: [
      "Kneel with the wheel under the shoulders.",
      "Tuck the ribs down and squeeze the glutes before moving.",
      "Start with a short range and build it.",
    ],
    execution: [
      "Roll out only as far as you can hold the lower back flat.",
      "Keep the hips and shoulders moving together.",
      "Pull back by bracing the stomach, not by yanking the arms.",
    ],
    mistakes: [
      { wrong: "Lower back arching as you roll out", fix: "That is your limit — shorten the range immediately." },
      { wrong: "Piking the hips to get back", fix: "Roll back with the abs; reduce the range if you cannot." },
    ],
    breathing: "In as you roll out, out as you pull back.",
  },
  "dead-bug": {
    setup: [
      "Lie on your back, arms straight up, knees over the hips at 90°.",
      "Press the lower back gently into the floor.",
      "Hold that contact — it is the whole exercise.",
    ],
    execution: [
      "Lower one arm overhead and the opposite leg toward the floor.",
      "Stop before the lower back lifts away from the floor.",
      "Return and repeat on the other side.",
    ],
    mistakes: [
      { wrong: "Lower back arching off the floor", fix: "Shorten the reach — control beats range here." },
      { wrong: "Rushing through the reps", fix: "Slow and deliberate; it is a control drill." },
    ],
    breathing: "Out as you extend, in as you return.",
  },
  "bicycle-crunch": {
    setup: [
      "Lie on your back, hands light at the temples.",
      "Knees up over the hips, lower back pressed down.",
      "Elbows wide — do not pull on the neck.",
    ],
    execution: [
      "Bring one elbow toward the opposite knee while the other leg extends.",
      "Rotate through the ribs, not just the elbow.",
      "Alternate smoothly and keep the extended leg off the floor.",
    ],
    mistakes: [
      { wrong: "Hauling on the back of the head", fix: "Fingers rest at the temples; the abs do the lifting." },
      { wrong: "Racing through reps with no rotation", fix: "Slow down and actually turn the ribcage." },
    ],
    breathing: "Out on each twist, in as you switch.",
  },
};

/**
 * Pattern fallbacks, so the several hundred library exercises without a
 * bespoke entry still get something honest instead of an empty panel.
 */
const PATTERNS: { match: RegExp; coaching: ExerciseCoaching }[] = [
  {
    match: /curl/i,
    coaching: {
      setup: ["Elbows pinned at your sides.", "Stand tall with the core braced.", "Start from a full stretch."],
      execution: ["Bend only at the elbow.", "Squeeze at the top.", "Lower slowly to full extension."],
      mistakes: [
        { wrong: "Swinging the body to move the weight", fix: "Go lighter and keep the torso still." },
        { wrong: "Cutting the bottom of the range", fix: "Straighten the arms fully between reps." },
      ],
      breathing: "Out as you lift, in as you lower.",
    },
  },
  {
    match: /press|push/i,
    coaching: {
      setup: ["Set the shoulders back and down.", "Brace the core.", "Grip stacked over the wrists."],
      execution: ["Lower under control.", "Press in a straight line.", "Stop just short of locking out."],
      mistakes: [
        { wrong: "Bouncing the weight at the bottom", fix: "Control the descent and press from a dead stop." },
        { wrong: "Arching the back to grind a rep", fix: "Reduce the load and keep the ribs down." },
      ],
      breathing: "In as it lowers, out as you press.",
    },
  },
  {
    match: /row|pull|chin/i,
    coaching: {
      setup: ["Chest up, shoulders pulled down.", "Brace the core.", "Start from a full stretch."],
      execution: ["Lead with the elbows.", "Squeeze the shoulder blades at the end of the pull.", "Return under control."],
      mistakes: [
        { wrong: "Rocking the torso for momentum", fix: "Lock the torso and let the back work." },
        { wrong: "Shrugging the weight up", fix: "Keep the shoulders down." },
      ],
      breathing: "Out as you pull, in as you return.",
    },
  },
  {
    match: /squat|lunge|leg|glute|calf/i,
    coaching: {
      setup: ["Feet planted, whole foot in contact.", "Chest up, core braced.", "Knees tracking over the toes."],
      execution: ["Descend under control.", "Take the range your mobility allows with a flat back.", "Drive up through the whole foot."],
      mistakes: [
        { wrong: "Knees caving inward", fix: "Push them out in line with the toes." },
        { wrong: "Heels lifting off the floor", fix: "Widen the stance or reduce the depth." },
      ],
      breathing: "In as you lower, out as you drive up.",
    },
  },
  {
    match: /raise|fly|delt/i,
    coaching: {
      setup: ["Light weight — these are small muscles.", "Soft bend in the elbows.", "Stand or sit tall."],
      execution: ["Lead with the elbows.", "Stop at shoulder height.", "Lower slowly and resist the whole way."],
      mistakes: [
        { wrong: "Swinging the weight up", fix: "Halve the load and remove the momentum." },
        { wrong: "Changing the elbow angle mid-rep", fix: "Keep it fixed so the target muscle keeps the tension." },
      ],
      breathing: "Out as you raise, in as you lower.",
    },
  },
  {
    match: /plank|crunch|ab|core|hollow/i,
    coaching: {
      setup: ["Press the lower back toward the floor.", "Tuck the ribs down.", "Breathe normally before you start."],
      execution: ["Move slowly and deliberately.", "Keep tension on the abs the whole set.", "Stop when the position breaks."],
      mistakes: [
        { wrong: "Pulling on the head or neck", fix: "Hands stay light; the abs do the work." },
        { wrong: "Holding the breath", fix: "Breathe steadily throughout." },
      ],
      breathing: "Steady breathing — never hold it.",
    },
  },
];

/**
 * Coaching for an exercise: the bespoke entry when there is one, otherwise the
 * closest movement pattern, otherwise nothing (better silent than generic).
 */
export function coachingFor(exerciseId: string, name = ""): ExerciseCoaching | null {
  const exact = COACHING[exerciseId];
  if (exact) return exact;
  const haystack = `${exerciseId} ${name}`;
  for (const p of PATTERNS) if (p.match.test(haystack)) return p.coaching;
  return null;
}

export const COACHED_EXERCISE_IDS = Object.keys(COACHING);
