
import { ArchitectAgent } from './architect';
import { FrontendAgent } from './frontend';
import { BackendAgent } from './backend';
import { QAAgent } from './qa';
import { DevOpsAgent } from './devops';
import { DataAgent } from './data';
import { AiEngAgent } from './ai_eng';
import { ProductAgent } from './product';
import { WiddxAgentRole, AgentProfile } from './types';

export const WiddxAgents: Record<WiddxAgentRole, AgentProfile> = {
    ARCHITECT: ArchitectAgent,
    FRONTEND: FrontendAgent,
    BACKEND: BackendAgent,
    QA: QAAgent,
    DEVOPS: DevOpsAgent,
    DATA: DataAgent,
    AI_ENG: AiEngAgent,
    PRODUCT: ProductAgent
};

export type { WiddxAgentRole, AgentProfile };
