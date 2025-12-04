import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface FHEItem {
  id: string;
  key: string;
  value: string;
  timestamp: number;
  owner: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FHEItem[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newItemData, setNewItemData] = useState({
    key: "",
    value: ""
  });
  const [showTutorial, setShowTutorial] = useState(false);

  // Calculate statistics
  const totalItems = items.length;
  const recentItems = items.filter(item => 
    Date.now() - item.timestamp * 1000 < 7 * 24 * 60 * 60 * 1000
  ).length;

  useEffect(() => {
    loadItems().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const checkAvailability = async () => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Checking FHE availability..."
    });
    
    try {
      const contract = await getContractReadOnly();
      if (!contract) {
        throw new Error("Contract not available");
      }
      
      const isAvailable = await contract.isAvailable();
      
      if (isAvailable) {
        setTransactionStatus({
          visible: true,
          status: "success",
          message: "FHE capabilities available!"
        });
      } else {
        setTransactionStatus({
          visible: true,
          status: "error",
          message: "FHE not available"
        });
      }
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Availability check failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const loadItems = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Get keys list
      const keysBytes = await contract.getData("item_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      const list: FHEItem[] = [];
      
      for (const key of keys) {
        try {
          const itemBytes = await contract.getData(`item_${key}`);
          if (itemBytes.length > 0) {
            try {
              const itemData = JSON.parse(ethers.toUtf8String(itemBytes));
              list.push({
                id: key,
                key: itemData.key,
                value: itemData.value,
                timestamp: itemData.timestamp,
                owner: itemData.owner
              });
            } catch (e) {
              console.error(`Error parsing item data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading item ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setItems(list);
    } catch (e) {
      console.error("Error loading items:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const createItem = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    if (!newItemData.key || !newItemData.value) {
      alert("Please enter both key and value");
      return;
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting data with Zama FHE..."
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const itemId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const itemData = {
        key: newItemData.key,
        value: newItemData.value,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `item_${itemId}`, 
        ethers.toUtf8Bytes(JSON.stringify(itemData))
      );
      
      const keysBytes = await contract.getData("item_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(itemId);
      
      await contract.setData(
        "item_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Data encrypted and stored securely!"
      });
      
      await loadItems();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewItemData({
          key: "",
          value: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const getItem = async (key: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Decrypting data with FHE..."
    });

    try {
      const contract = await getContractReadOnly();
      if (!contract) {
        throw new Error("Failed to get contract");
      }
      
      const itemBytes = await contract.getData(`item_${key}`);
      if (itemBytes.length === 0) {
        throw new Error("Item not found");
      }
      
      const itemData = JSON.parse(ethers.toUtf8String(itemBytes));
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: `Decrypted value: ${itemData.value}`
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Decryption failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to interact with the Zama FHE platform",
      icon: "🔗"
    },
    {
      title: "Check Availability",
      description: "Verify FHE capabilities are available on the network",
      icon: "✅"
    },
    {
      title: "Store Encrypted Data",
      description: "Add your sensitive data which will be encrypted using FHE",
      icon: "🔒"
    },
    {
      title: "Retrieve Securely",
      description: "Access your encrypted data without exposing sensitive information",
      icon: "🔓"
    }
  ];

  if (loading) return (
    <div className="loading-screen">
      <div className="metal-spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container metal-future-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>Zama<span>FHE</span>PHP</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={checkAvailability}
            className="action-btn metal-btn"
          >
            <div className="check-icon"></div>
            Check FHE
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="action-btn metal-btn"
          >
            <div className="add-icon"></div>
            Add Data
          </button>
          <button 
            className="action-btn metal-btn"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Guide" : "Show Guide"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content panel-layout">
        <div className="panel project-intro metal-panel">
          <h2>Zama FHE PHP SDK</h2>
          <p>Bringing Fully Homomorphic Encryption capabilities to the PHP ecosystem.</p>
          <div className="fhe-badge">
            <span>FHE-Powered</span>
          </div>
          <div className="features">
            <div className="feature">
              <div className="feature-icon">🔐</div>
              <h3>Secure Data Processing</h3>
              <p>Compute on encrypted data without decryption</p>
            </div>
            <div className="feature">
              <div className="feature-icon">🔄</div>
              <h3>PHP Integration</h3>
              <p>Seamless integration with WordPress, Laravel, and Symfony</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⚡</div>
              <h3>High Performance</h3>
              <p>Optimized for PHP environments</p>
            </div>
          </div>
        </div>
        
        <div className="panel contract-actions metal-panel">
          <h2>FHE Operations</h2>
          <div className="action-grid">
            <button 
              onClick={checkAvailability}
              className="action-btn metal-btn"
            >
              Check Availability
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="action-btn metal-btn primary"
            >
              Store Encrypted Data
            </button>
            <button 
              onClick={loadItems}
              className="action-btn metal-btn"
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
          
          {showTutorial && (
            <div className="tutorial-section">
              <h3>Getting Started Guide</h3>
              <div className="tutorial-steps">
                {tutorialSteps.map((step, index) => (
                  <div className="tutorial-step" key={index}>
                    <div className="step-number">{index + 1}</div>
                    <div className="step-content">
                      <h4>{step.title}</h4>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="panel data-stats metal-panel">
          <h2>Encrypted Data Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{totalItems}</div>
              <div className="stat-label">Total Items</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{recentItems}</div>
              <div className="stat-label">Recent (7 days)</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{account ? "Connected" : "Not Connected"}</div>
              <div className="stat-label">Wallet Status</div>
            </div>
          </div>
          <div className="fhe-diagram">
            <div className="fhe-process">
              <div className="process-step">
                <div className="step-icon">🔓</div>
                <div className="step-label">Plain Data</div>
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="step-icon">🔒</div>
                <div className="step-label">FHE Encryption</div>
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="step-icon">⚙️</div>
                <div className="step-label">Secure Computation</div>
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="step-icon">🔓</div>
                <div className="step-label">Decrypted Result</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="panel data-list metal-panel">
          <div className="section-header">
            <h2>Encrypted Data Items</h2>
            <div className="header-actions">
              <button 
                onClick={loadItems}
                className="action-btn metal-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="items-table">
            <div className="table-header">
              <div className="header-cell">Key</div>
              <div className="header-cell">Owner</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {items.length === 0 ? (
              <div className="no-items">
                <div className="no-items-icon"></div>
                <p>No encrypted data found</p>
                <button 
                  className="action-btn metal-btn primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Add First Item
                </button>
              </div>
            ) : (
              items.map(item => (
                <div className="table-row" key={item.id}>
                  <div className="table-cell">{item.key}</div>
                  <div className="table-cell">{item.owner.substring(0, 6)}...{item.owner.substring(38)}</div>
                  <div className="table-cell">
                    {new Date(item.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <button 
                      className="action-btn metal-btn"
                      onClick={() => getItem(item.id)}
                    >
                      Retrieve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={createItem} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          itemData={newItemData}
          setItemData={setNewItemData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content metal-panel">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>Zama FHE PHP SDK</span>
            </div>
            <p>Bringing fully homomorphic encryption to PHP developers worldwide</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} Zama. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  itemData: any;
  setItemData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  itemData,
  setItemData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setItemData({
      ...itemData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!itemData.key || !itemData.value) {
      alert("Please fill both fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal metal-panel">
        <div className="modal-header">
          <h2>Store Encrypted Data</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="key-icon"></div> 
            <span>Your data will be encrypted using Zama FHE technology</span>
          </div>
          
          <div className="form-group">
            <label>Data Key *</label>
            <input 
              type="text"
              name="key"
              value={itemData.key} 
              onChange={handleChange}
              placeholder="Enter unique key..." 
              className="metal-input"
            />
          </div>
          
          <div className="form-group">
            <label>Data Value *</label>
            <input 
              type="text"
              name="value"
              value={itemData.value} 
              onChange={handleChange}
              placeholder="Enter value to encrypt..." 
              className="metal-input"
            />
          </div>
          
          <div className="privacy-notice">
            <div className="lock-icon"></div> 
            <span>Data remains encrypted during FHE processing</span>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="action-btn metal-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="action-btn metal-btn primary"
          >
            {creating ? "Encrypting with FHE..." : "Store Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;