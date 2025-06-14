const mongoose = require('mongoose');

const userWalletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    walletType: {
        type: String,
        enum: ['METAMASK', 'WALLET_CONNECT', 'BINANCE_WALLET', 'TRUST_WALLET', 'OTHER'],
        default: 'METAMASK'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationSignature: {
        type: String
    },
    verificationMessage: {
        type: String
    },
    verificationDate: {
        type: Date
    },
    balance: {
        cbt: {
            type: String,
            default: '0'
        },
        bnb: {
            type: String,
            default: '0'
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    transactionHistory: [{
        transactionHash: String,
        type: String,
        amount: String,
        timestamp: Date,
        status: String
    }],
    preferences: {
        autoClaimRewards: {
            type: Boolean,
            default: true
        },
        notifyOnTransactions: {
            type: Boolean,
            default: true
        },
        preferredGasPrice: {
            type: String,
            default: 'standard'
        }
    },
    statistics: {
        totalEarned: {
            type: String,
            default: '0'
        },
        totalSpent: {
            type: String,
            default: '0'
        },
        totalTransactions: {
            type: Number,
            default: 0
        },
        firstTransactionDate: {
            type: Date
        },
        lastTransactionDate: {
            type: Date
        }
    }
}, {
    timestamps: true
});

// 索引
userWalletSchema.index({ userId: 1 });
userWalletSchema.index({ walletAddress: 1 });
userWalletSchema.index({ isVerified: 1 });

// 虚拟字段
userWalletSchema.virtual('formattedBalance').get(function() {
    return {
        cbt: parseFloat(this.balance.cbt || '0'),
        bnb: parseFloat(this.balance.bnb || '0')
    };
});

// 实例方法
userWalletSchema.methods.updateBalance = async function(cbtBalance, bnbBalance) {
    this.balance.cbt = cbtBalance.toString();
    this.balance.bnb = bnbBalance.toString();
    this.balance.lastUpdated = new Date();
    return this.save();
};

userWalletSchema.methods.addTransaction = async function(transactionData) {
    this.transactionHistory.push({
        transactionHash: transactionData.hash,
        type: transactionData.type,
        amount: transactionData.amount,
        timestamp: new Date(),
        status: transactionData.status || 'PENDING'
    });
    
    // 保持最近100条交易记录
    if (this.transactionHistory.length > 100) {
        this.transactionHistory = this.transactionHistory.slice(-100);
    }
    
    // 更新统计
    this.statistics.totalTransactions += 1;
    this.statistics.lastTransactionDate = new Date();
    
    if (!this.statistics.firstTransactionDate) {
        this.statistics.firstTransactionDate = new Date();
    }
    
    return this.save();
};

userWalletSchema.methods.updateStatistics = async function(earned, spent) {
    if (earned) {
        const currentEarned = parseFloat(this.statistics.totalEarned || '0');
        this.statistics.totalEarned = (currentEarned + parseFloat(earned)).toString();
    }
    
    if (spent) {
        const currentSpent = parseFloat(this.statistics.totalSpent || '0');
        this.statistics.totalSpent = (currentSpent + parseFloat(spent)).toString();
    }
    
    return this.save();
};

module.exports = mongoose.model('UserWallet', userWalletSchema);

