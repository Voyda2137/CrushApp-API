#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProjektZpoStack } from '../lib/projekt_zpo-stack';

const app = new cdk.App();
new ProjektZpoStack(app, 'ProjektZpoStack');
