// Coach guidance per exam test — transcribed verbatim from the HBA Training
// System v2 brief's detailed assessment blocks (Objective / Test Method / Pass
// Indicator). Keyed by [fromLevel][sectionKey][itemIndex] and merged into
// EXAM_SPECS items in training.ts. Where the brief gives no detail for an item,
// it simply has no panel. Item maxes + labels live in training.ts.
import type { SectionKey, ItemGuide } from "@/lib/training";

// Generic 0–5 performance rubric shown alongside every test (the brief's
// Performance Rubric tables follow this same pattern).
export const PERFORMANCE_RUBRIC: { score: string; label: string }[] = [
  { score: "5", label: "Excellent — clean, consistent, controlled" },
  { score: "4", label: "Good — mostly controlled" },
  { score: "3", label: "Basic — inconsistent" },
  { score: "2", label: "Poor technique" },
  { score: "1", label: "Very weak" },
  { score: "0", label: "Cannot perform" },
];

export const EXAM_GUIDE: Record<number, Partial<Record<SectionKey, Record<number, ItemGuide>>>> = {
  "1": {
    technical: {
      "0": {
        objective: "Assess student’s ability to perform basic forehand lobbing with correct contact.",
        method: "Coach feeds 10 easy shuttles to mid court. Student performs straight lobbing.",
        pass: "At least 6 out of 10 shuttles travel in correct direction."
      },
      "1": {
        objective: "Assess ability to lift shuttle from front court to rear court.",
        method: "Coach feeds 10 shuttles to forecourt.",
        pass: "Minimum 5 lifts reaching mid/back court."
      },
      "2": {
        method: "Student performs 10 high serves.",
        pass: "At least 6 serves land in correct rear service area."
      }
    },
    footwork: {
      "1": {
        method: "Student performs 4-corner shadow movement for 20 seconds."
      }
    }
  },
  "2": {
    technical: {
      "0": {
        method: "Coach feeds 10 shuttles from rear court. Student performs 5 straight + 5 cross drops.",
        pass: "Minimum 6 drops land in front court target zone."
      },
      "1": {
        method: "Coach feeds 10 net shuttles."
      },
      "2": {
        method: "Student performs 10 low serves.",
        pass: "Minimum 7 serves pass close to tape and land correctly."
      }
    },
    footwork: {
      "0": {
        method: "Student performs six corner shadow movement for 30 seconds."
      },
      "1": {
        method: "Coach gives random corner commands."
      }
    }
  },
  "3": {
    technical: {
      "0": {
        method: "Coach feeds 10 lifts.",
        pass: "At least 6 smashes land in attacking zone."
      },
      "1": {
        method: "Coach feeds 10 forecourt shuttles."
      }
    },
    footwork: {
      "0": {
        method: "Timed six-corner shadow footwork."
      }
    }
  },
  "4": {
    technical: {
      "0": {
        objective: "Assess student’s ability to execute a jump smash with correct timing, power, and landing control.",
        method: "Coach feeds 10 lifts to the rear court. Student performs jump smash from the backcourt.",
        pass: "At least 6 out of 10 smashes land in the attacking zone with proper jump technique."
      },
      "1": {
        objective: "Assess flat, fast drive shots on both forehand and backhand sides under rally pressure.",
        method: "Coach and student exchange flat drives for 30 seconds each side (FH and BH).",
        pass: "Maintains a controlled drive rally for at least 8 consecutive shots on both sides."
      },
      "2": {
        objective: "Assess reaction speed and finishing power when attacking a loose shot at the net.",
        method: "Coach feeds 10 loose net shuttles. Student must kill the shuttle steeply downward.",
        pass: "At least 6 out of 10 attempts result in a clean, downward kill."
      },
      "3": {
        objective: "Assess ability to clear the shuttle to the back court using correct backhand technique.",
        method: "Coach feeds 10 shuttles to the backhand rear corner. Student performs backhand clear to the opposite back court.",
        pass: "At least 6 out of 10 clears reach the back third of the court."
      }
    },
    footwork: {
      "0": {
        objective: "Assess speed, efficiency, and balance across all six corners of the court under game-paced movement.",
        method: "Student performs advanced six corner shadow movement for 40 seconds at competition pace.",
        pass: "Completes the pattern with no major technique breakdown and returns to base after each corner."
      },
      "1": {
        objective: "Assess the student’s ability to recover quickly into ready position after an attacking shot.",
        method: "Coach calls random attack-then-recover sequences for 10 repetitions.",
        pass: "Recovers to ready position correctly in at least 7 out of 10 repetitions."
      }
    },
    tactical: {
      "0": {
        objective: "Assess decision-making in singles attack/defense transitions and doubles rotation discipline during live or simulated rally play.",
        method: "Coach observes student during live rally / simulated match play (minimum 5 rallies each for singles and doubles).",
        pass: "Scores at least 14 out of 20 across both singles and doubles observation."
      }
    },
    physical: {
      "0": {
        objective: "Assess physical readiness and training attitude appropriate for Competition Team entry.",
        method: "Assessed through speed endurance shuttle runs, agility ladder drills, and coach observation of attitude across the full session.",
        pass: "Scores at least 9 out of 15 across the three physical / attitude items."
      }
    }
  },
  "5": {
    technical: {
      "0": {
        objective: "Assess ability to vary smash placement, pace, and angle to create attacking opportunities.",
        method: "Coach feeds 10 lifts. Student must vary smash direction (straight / cross / body) across attempts.",
        pass: "Demonstrates at least 3 distinct smash variations with 6 out of 10 landing in target zones."
      },
      "1": {
        objective: "Assess ability to disguise a drop shot as a smash or clear to deceive the opponent.",
        method: "Coach feeds 10 lifts. Student must disguise the shot preparation before playing a drop.",
        pass: "At least 6 out of 10 drops show effective disguise and land accurately."
      },
      "2": {
        objective: "Assess fine net control by spinning the shuttle tight along the net.",
        method: "Coach feeds 10 net shuttles. Student performs net spin shots.",
        pass: "At least 6 out of 10 spins tumble tightly along the net."
      },
      "3": {
        objective: "Assess ability to sustain a fast, flat drive exchange under competitive pace.",
        method: "Coach and student exchange fast drives for 45 seconds at competition intensity.",
        pass: "Sustains the rally for at least 30 seconds without a major error."
      }
    },
    footwork: {
      "0": {
        objective: "Assess explosive speed and control across all six corners under maximum-intensity movement.",
        method: "Student performs explosive six corner shadow movement for 45 seconds at maximum effort.",
        pass: "Maintains explosive speed and correct technique through the full 45 seconds."
      },
      "1": {
        objective: "Assess movement and shot execution under continuous multi-shuttle feeding (no recovery time between shots).",
        method: "Coach feeds 15 shuttles continuously to random corners with minimal gap between feeds.",
        pass: "Successfully returns at least 10 out of 15 shuttles with acceptable technique."
      }
    },
    tactical: {
      "0": {
        objective: "Assess ability to plan and adapt strategy during a match based on opponent behaviour.",
        method: "Coach observes student during a practice match (minimum one game to 11 or 15 points).",
        pass: "Scores at least 7 out of 10 on match strategy observation."
      },
      "1": {
        objective: "Assess ability to dominate court space and dictate rally tempo against an opponent.",
        method: "Coach observes student during the same practice match used for Test 7.",
        pass: "Scores at least 7 out of 10 on court control observation."
      }
    },
    physical: {
      "0": {
        objective: "Assess physical power, endurance, and mental discipline required for Elite Team entry.",
        method: "Assessed through jump power test, interval shuttle run, and coach observation of mental discipline during high-pressure drills.",
        pass: "Scores at least 9 out of 15 across the three physical / mental items."
      }
    }
  },
  "6": {
    technical: {
      "0": {
        objective: "Assess overall deceptive shot-making across multiple strokes (smash, drop, drive) under live rally conditions.",
        method: "Coach observes during live rally play (minimum 10 rallies) for deceptive shot use.",
        pass: "Demonstrates effective deception in at least 6 out of 10 rallies."
      },
      "1": {
        objective: "Assess execution of advanced variation shots such as reverse slice drop and angle variation strokes.",
        method: "Coach feeds 10 shuttles for student to play reverse slice / variation shots.",
        pass: "At least 6 out of 10 attempts executed cleanly and land accurately."
      },
      "2": {
        objective: "Assess power and accuracy of backhand smash and advanced attacking shots.",
        method: "Coach feeds 10 shuttles to the backhand rear corner for backhand smash attempts.",
        pass: "At least 5 out of 10 backhand smashes land in the attacking zone with genuine pace."
      },
      "3": {
        objective: "Assess advanced net control including tumbling and spinning net shots under pressure.",
        method: "Coach feeds 10 net shuttles at varying speed and angle.",
        pass: "At least 6 out of 10 net shots show controlled tumbling/spin."
      }
    },
    footwork: {
      "0": {
        objective: "Assess movement, decision-making and shot execution under unpredictable, continuous multi-shuttle feeding.",
        method: "Coach feeds 20 shuttles to random corners at competition pace with no set pattern.",
        pass: "Successfully handles at least 15 out of 20 shuttles with acceptable technique and recovery."
      },
      "1": {
        objective: "Assess recovery speed and balance immediately after maximal-effort attacking or defensive shots.",
        method: "Coach calls random attack/defense sequences at maximum pace for 10 repetitions.",
        pass: "Recovers correctly in at least 8 out of 10 repetitions."
      }
    },
    tactical: {
      "0": {
        objective: "Assess ability to build a rally with purpose and control its tempo (slow it down or accelerate it) to gain advantage.",
        method: "Coach observes student during a full practice match (minimum one game).",
        pass: "Scores at least 7 out of 10 on rally construction / tempo control."
      },
      "1": {
        objective: "Assess ability to read an opponent’s patterns and intentions and make correct in-match decisions in response.",
        method: "Coach observes student during the same practice match used for Test 7, focusing on decision-making against opponent patterns.",
        pass: "Scores at least 7 out of 10 on opponent reading / match decision."
      }
    },
    physical: {
      "0": {
        objective: "Assess elite-level physical capacity and competitive composure under pressure.",
        method: "Assessed through strength testing, endurance interval running, and coach observation of composure during a high-pressure simulated match or drill.",
        pass: "Scores at least 9 out of 15 across the three physical / mental items. Below this, the Elite Review committee should discuss whether the student remains in the Elite Team or returns to Competition Team for further development."
      }
    }
  }
};
