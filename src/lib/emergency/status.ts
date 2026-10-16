// What each emergency request status means, in words that never overstate what has happened.
export const EMERGENCY_STATUS: Record<string, { label: string; explanation: string; tone: "neutral" | "primary" | "warning" | "urgent" | "success" }> = {
  received: { label: "Received: not yet seen by a responder", explanation: "Your request is in our queue. Keep calling local emergency services if life is at risk.", tone: "warning" },
  acknowledged: { label: "Seen by a responder", explanation: "A MedTRANS responder has read your request.", tone: "primary" },
  assigned: { label: "A responder is handling it", explanation: "A responder has taken responsibility and will call your number.", tone: "primary" },
  coordination_in_progress: { label: "Responder is coordinating", explanation: "A responder is actively working on your request.", tone: "primary" },
  referred_externally: { label: "Referred to emergency services or a facility", explanation: "The responder has passed your case on. Follow their instructions.", tone: "primary" },
  completed: { label: "Closed by the responder", explanation: "This request has been closed.", tone: "success" },
  cancelled: { label: "Cancelled", explanation: "This request was cancelled.", tone: "neutral" },
  unable_to_connect: { label: "We couldn't reach you", explanation: "A responder tried to call and couldn't get through. If you still need help, call local emergency services now.", tone: "urgent" },
  escalated: { label: "Escalated to the supervisor", explanation: "Your request has been raised to the duty supervisor.", tone: "primary" },
};

export const SEVERITY: Record<string, string> = {
  life_threatening: "Life-threatening",
  urgent: "Urgent",
  non_emergency_home_care: "Non-emergency (home care)",
  general_inquiry: "General inquiry",
};
