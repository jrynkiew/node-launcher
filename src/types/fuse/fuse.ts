import { Ethereum } from '../ethereum/ethereum';
import { defaultDockerNetwork, NetworkType, NodeClient, NodeType } from '../../constants';
import { v4 as uuid } from 'uuid';
import { CryptoNodeData, VersionDockerImage } from '../../interfaces/crypto-node';
import { Docker } from '../../util/docker';
import { ChildProcess } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { filterVersionsByNetworkType } from '../../util';

const coreConfig = `
[parity]
chain = "/home/parity/.local/share/io.parity.ethereum/spec.json"
db_path = "/root/data"
keys_path = "/root/keystore"

[rpc]
cors = ["all"]
port = {{RPC_PORT}}
interface = "all"
hosts = ["all"]
apis = ["web3", "eth", "net", "parity", "traces", "rpc", "secretstore"]

[websockets]
disable = true

[network]
port = {{PEER_PORT}}
reserved_peers="/home/parity/.local/share/io.parity.ethereum/bootnodes.txt"
`;

export class Fuse extends Ethereum {

  static versions(client: string, networkType: string): VersionDockerImage[] {
    client = client || Fuse.clients[0];
    let versions: VersionDockerImage[];
    switch(client) {
      case NodeClient.OPEN_ETHEREUM:
        versions = [
          {
            version: '2.0.1',
            clientVersion: '3.2.6',
            image: 'fusenet/node:2.0.1',
            dataDir: '/root/data',
            walletDir: '/root/keystore',
            configPath: '/root/config.toml',
            networks: [NetworkType.MAINNET],
            breaking: false,
            generateRuntimeArgs(data: CryptoNodeData): string {
              return ` --config=${this.configPath}`;
            },
          },
          {
            version: '2.5.13',
            clientVersion: '2.5.13',
            image: 'fusenet/node:1.0.0',
            dataDir: '/root/data',
            walletDir: '/root/keystore',
            configPath: '/root/config.toml',
            networks: [NetworkType.MAINNET],
            breaking: false,
            generateRuntimeArgs(data: CryptoNodeData): string {
              return ` --config=${this.configPath}`;
            },
          },
        ];
        break;
      default:
        versions = [];
    }
    return filterVersionsByNetworkType(networkType, versions);
  }

  static clients = [
    NodeClient.OPEN_ETHEREUM,
  ];

  static nodeTypes = [
    NodeType.FULL,
  ];

  static networkTypes = [
    NetworkType.MAINNET,
  ];

  static defaultRPCPort = {
    [NetworkType.MAINNET]: 8545,
  };

  static defaultPeerPort = {
    [NetworkType.MAINNET]: 30300,
  };

  static defaultCPUs = 6;

  static defaultMem = 8192;

  static generateConfig(client = Fuse.clients[0], network = NetworkType.MAINNET, peerPort = Fuse.defaultPeerPort[NetworkType.MAINNET], rpcPort = Fuse.defaultRPCPort[NetworkType.MAINNET]): string {
    switch(client) {
      case NodeClient.OPEN_ETHEREUM:
        return coreConfig
          .replace('{{PEER_PORT}}', peerPort.toString(10))
          .replace(/{{RPC_PORT}}/g, rpcPort.toString(10))
          .trim();
      case NodeClient.PARITY:
        return coreConfig
          .replace('{{PEER_PORT}}', peerPort.toString(10))
          .replace(/{{RPC_PORT}}/g, rpcPort.toString(10))
          .trim();
      default:
        return '';
    }
  }

  id: string;
  ticker = 'fuse';
  name = 'Fuse';
  version: string;
  clientVersion: string;
  archival = false;
  dockerImage: string;
  network: string;
  peerPort: number;
  rpcPort: number;
  rpcUsername: string;
  rpcPassword: string;
  client: string;
  dockerCPUs = Fuse.defaultCPUs;
  dockerMem = Fuse.defaultMem;
  dockerNetwork = defaultDockerNetwork;
  dataDir = '';
  walletDir = '';
  configPath = '';

  constructor(data: CryptoNodeData, docker?: Docker) {
    super(data, docker);
    this.id = data.id || uuid();
    this.network = data.network || NetworkType.MAINNET;
    this.peerPort = data.peerPort || Fuse.defaultPeerPort[this.network];
    this.rpcPort = data.rpcPort || Fuse.defaultRPCPort[this.network];
    this.rpcUsername = data.rpcUsername || '';
    this.rpcPassword = data.rpcPassword || '';
    this.client = data.client || Fuse.clients[0];
    this.dockerCPUs = data.dockerCPUs || this.dockerCPUs;
    this.dockerMem = data.dockerMem || this.dockerMem;
    this.dockerNetwork = data.dockerNetwork || this.dockerNetwork;
    this.dataDir = data.dataDir || this.dataDir;
    this.walletDir = data.walletDir || this.dataDir;
    this.configPath = data.configPath || this.configPath;
    this.createdAt = data.createdAt || this.createdAt;
    this.updatedAt = data.updatedAt || this.updatedAt;
    this.remote = data.remote || this.remote;
    this.remoteDomain = data.remoteDomain || this.remoteDomain;
    this.remoteProtocol = data.remoteProtocol || this.remoteProtocol;
    const versions = Fuse.versions(this.client, this.network);
    this.version = data.version || (versions && versions[0] ? versions[0].version : '');
    const versionObj = versions.find(v => v.version === this.version) || versions[0] || {};
    this.clientVersion = data.clientVersion || versionObj.clientVersion || '';
    this.dockerImage = this.remote ? '' : data.dockerImage ? data.dockerImage : (versionObj.image || '');
    this.archival = data.archival || this.archival;
    if(docker)
      this._docker = docker;
  }

  async start(): Promise<ChildProcess> {
    const versions = Fuse.versions(this.client, this.network);
    const versionData = versions.find(({ version }) => version === this.version) || versions[0];
    if(!versionData)
      throw new Error(`Unknown ${this.ticker} version ${this.version}`);
    const {
      dataDir: containerDataDir,
      walletDir: containerWalletDir,
      configPath: containerConfigPath,
    } = versionData;
    let args = [
      '-i',
      '--rm',
      '--memory', this.dockerMem.toString(10) + 'MB',
      '--cpus', this.dockerCPUs.toString(10),
      '--name', this.id,
      '--network', this.dockerNetwork,
      '-p', `${this.rpcPort}:${this.rpcPort}`,
      '-p', `${this.peerPort}:${this.peerPort}`,
      '--entrypoint', '/usr/local/bin/parity',
    ];
    const tmpdir = os.tmpdir();
    const dataDir = this.dataDir || path.join(tmpdir, uuid());
    args = [...args, '-v', `${dataDir}:${containerDataDir}`];
    await fs.ensureDir(dataDir);

    const walletDir = this.walletDir || path.join(tmpdir, uuid());
    args = [...args, '-v', `${walletDir}:${containerWalletDir}`];
    await fs.ensureDir(walletDir);

    const configPath = this.configPath || path.join(tmpdir, uuid());
    const configExists = await fs.pathExists(configPath);
    if(!configExists)
      await fs.writeFile(configPath, this.generateConfig(), 'utf8');
    args = [...args, '-v', `${configPath}:${containerConfigPath}`];

    await this._docker.pull(this.dockerImage, str => this._logOutput(str));

    await this._docker.createNetwork(this.dockerNetwork);
    const instance = this._docker.run(
      this.dockerImage + versionData.generateRuntimeArgs(this),
      args,
      output => this._logOutput(output),
      err => this._logError(err),
      code => this._logClose(code),
    );
    this._instance = instance;
    return instance;
  }

  generateConfig(): string {
    return Fuse.generateConfig(
      this.client,
      this.network,
      this.peerPort,
      this.rpcPort);
  }

}
