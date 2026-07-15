export type WorkflowStatus =
  | "IDLE"
  | "RUNNING"
  | "PENDING_APPROVAL"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export interface CostEntry {
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  raw_cost_usd: number;
  estimated_savings_usd: number;
  routing_strategy: string;
}

export interface StepLogEntry {
  agent_name: string;
  department: string;
  input_summary: string;
  output_summary: string;
  duration_ms: number;
  error?: string | null;
  timestamp?: string | null;
  cost_entry?: CostEntry | null;
}

export interface CostSummary {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_raw_cost_usd: number;
  total_estimated_savings_usd: number;
  models_used: string[];
}

export interface HitlContext {
  reason: string;
  amount_usd: number;
  company: string;
  invoice_number: string;
  threshold_usd: number;
}

export interface LeadData {
  company?: string;
  deal_value?: number;
  contact_email?: string;
  lead_score?: string;
  source?: string;
  qualification_notes?: string;
  [key: string]: unknown;
}

export interface InvoiceData {
  invoice_number?: string;
  client_company?: string;
  contact_email?: string;
  subtotal_usd?: number;
  tax_usd?: number;
  tax_rate_pct?: number;
  total_usd?: number;
  currency?: string;
  due_date?: string;
  status?: string;
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  [key: string]: unknown;
}

export interface FinalOutput {
  lead_data?: LeadData;
  invoice_data?: InvoiceData;
}

/** Response from POST /execute-workflow */
export interface WorkflowExecuteResponse {
  run_id: string;
  status: string;
  step_log: StepLogEntry[];
  final_output: FinalOutput;
  cost_summary?: CostSummary | null;
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
  /** Populated when status === "PENDING_APPROVAL" */
  thread_id?: string | null;
  hitl_context?: HitlContext | null;
}

/** Request body for POST /execute-workflow */
export interface WorkflowExecuteRequest {
  input_prompt: string;
  org_id?: string | null;
}

/** Request body for POST /workflows/{thread_id}/approve */
export interface WorkflowApproveRequest {
  approved: boolean;
  operator_note?: string | null;
}

/** Response from POST /workflows/{thread_id}/approve */
export interface WorkflowApproveResponse {
  thread_id: string;
  run_id: string;
  status: string;
  step_log: StepLogEntry[];
  final_output: FinalOutput;
  cost_summary?: CostSummary | null;
  completed_at?: string | null;
  error?: string | null;
}

/** Full agent shape from GET /agents or POST */
export interface AgentRecord {
  id: string;
  department_id: string;
  name: string;
  role_description: string;
  system_prompt: string;
  default_model: string;
  is_active: boolean;
  created_at: string;
}

/** Department shape from GET /departments */
export interface DepartmentRecord {
  id: string;
  org_id: string;
  name: string;
  monthly_budget_usd: number;
  current_spend_usd: number;
  created_at: string;
}

/** Minimal cost log shape from GET /cost-logs */
export interface CostLogRecord {
  id: string;
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  raw_cost_usd: number;
  estimated_savings_usd: number;
  routing_strategy: string;
  timestamp: string;
}

/** Minimal workflow run shape from GET /workflows */
export interface WorkflowRunRecord {
  id: string;
  status: string;
  input_prompt: string;
  created_at: string;
}

