export type RemediationStatus = 'proposed' | 'approved' | 'rejected' | 'executed' | 'recovered';

export interface RemediationAction {
  actionId: string;
  targetVersionId: string;
  reason: string;
  status: RemediationStatus;
  approvedBy: string | null;
  simulated: true;
}

/**
 * Workshop remediation boundary. The state machine is real; the deployment
 * side effect is deliberately simulated in both fixture and Cloudflare modes.
 */
export class SimulatedRemediation {
  private actions = new Map<string, RemediationAction>();

  propose(targetVersionId: string, reason: string): RemediationAction {
    if (reason.trim().length < 10) throw new Error('Reason must explain the evidence');
    const action: RemediationAction = {
      actionId: crypto.randomUUID(),
      targetVersionId,
      reason: reason.trim(),
      status: 'proposed',
      approvedBy: null,
      simulated: true,
    };
    this.actions.set(action.actionId, action);
    return action;
  }

  reject(actionId: string, rejectedBy: string, reason: string): RemediationAction {
    const action = this.get(actionId);
    this.requireStatus(action, 'proposed');
    action.status = 'rejected';
    action.approvedBy = rejectedBy;
    action.reason = `${action.reason} Rejected: ${reason}`;
    return action;
  }

  approve(actionId: string, approvedBy: string): RemediationAction {
    const action = this.get(actionId);
    this.requireStatus(action, 'proposed');
    if (approvedBy.trim().length < 2) throw new Error('Approver is required');
    action.status = 'approved';
    action.approvedBy = approvedBy.trim();
    return action;
  }

  execute(actionId: string): RemediationAction {
    const action = this.get(actionId);
    this.requireStatus(action, 'approved');
    action.status = 'executed';
    return action;
  }

  verify(actionId: string): RemediationAction {
    const action = this.get(actionId);
    this.requireStatus(action, 'executed');
    action.status = 'recovered';
    return action;
  }

  private get(actionId: string): RemediationAction {
    const action = this.actions.get(actionId);
    if (!action) throw new Error('Remediation action not found');
    return action;
  }

  private requireStatus(action: RemediationAction, expected: RemediationStatus): void {
    if (action.status !== expected) throw new Error(`Action is ${action.status}; expected ${expected}`);
  }
}
