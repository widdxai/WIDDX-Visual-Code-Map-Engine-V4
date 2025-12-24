import { WiddxGraph, WiddxFileEntry } from '../types';
import { AnalysisPipeline } from './engine/analysisPipeline';
import { WiddxProtocolType } from './widdxProtocols';

/**
 * WIDDX Engine Facade
 * -------------------
 * The entry point for the WIDDX Static Analysis System.
 */
export class WiddxEngine {
  
  /**
   * Main entry point to analyze a set of files and produce a Neural Graph.
   * This is a "Cold Start" operation (O(N)).
   */
  public static async analyzeProject(files: WiddxFileEntry[], overrideProtocols?: WiddxProtocolType[]): Promise<WiddxGraph> {
    return await AnalysisPipeline.execute(files, overrideProtocols);
  }
}