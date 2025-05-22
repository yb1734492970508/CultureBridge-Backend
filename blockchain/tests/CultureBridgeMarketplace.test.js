const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CultureBridgeMarketplace", function () {
  let identityContract;
  let assetContract;
  let tokenContract;
  let marketplaceContract;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 部署身份合约
    const CultureBridgeIdentity = await ethers.getContractFactory("CultureBridgeIdentity");
    identityContract = await CultureBridgeIdentity.deploy();
    await identityContract.deployed();

    // 部署资产合约
    const CultureBridgeAsset = await ethers.getContractFactory("CultureBridgeAsset");
    assetContract = await CultureBridgeAsset.deploy(identityContract.address);
    await assetContract.deployed();

    // 部署代币合约
    const CultureBridgeToken = await ethers.getContractFactory("CultureBridgeToken");
    tokenContract = await CultureBridgeToken.deploy(identityContract.address);
    await tokenContract.deployed();

    // 部署市场合约
    const CultureBridgeMarketplace = await ethers.getContractFactory("CultureBridgeMarketplace");
    marketplaceContract = await CultureBridgeMarketplace.deploy(
      assetContract.address,
      tokenContract.address,
      identityContract.address
    );
    await marketplaceContract.deployed();

    // 注册用户
    await identityContract.registerUser("User1", "user1@example.com", "ipfs://user1profile");
    await identityContract.connect(user1).registerUser("User2", "user2@example.com", "ipfs://user2profile");
    await identityContract.connect(user2).registerUser("User3", "user3@example.com", "ipfs://user3profile");

    // 验证用户
    await identityContract.verifyUser(1);
    await identityContract.verifyUser(2);
    await identityContract.verifyUser(3);

    // 创建资产
    await assetContract.createAsset(
      "Art",
      "Chinese",
      "ipfs://asset1",
      "ipfs://metadata1"
    );

    // 转移资产给用户1
    await assetContract.transferFrom(owner.address, user1.address, 1);

    // 给用户2一些代币
    await tokenContract.transfer(user2.address, ethers.utils.parseEther("100"));
  });

  describe("Listing Assets", function () {
    it("Should allow users to list assets for sale", async function () {
      // 用户1挂单资产
      await assetContract.connect(user1).approve(marketplaceContract.address, 1);
      await marketplaceContract.connect(user1).listAsset(1, ethers.utils.parseEther("10"), "Beautiful Chinese Art");

      // 检查挂单信息
      const listing = await marketplaceContract.getListing(1);
      expect(listing.tokenId).to.equal(1);
      expect(listing.seller).to.equal(user1.address);
      expect(listing.price).to.equal(ethers.utils.parseEther("10"));
      expect(listing.isActive).to.equal(true);
      expect(listing.description).to.equal("Beautiful Chinese Art");
    });

    it("Should not allow non-owners to list assets", async function () {
      await expect(
        marketplaceContract.connect(user2).listAsset(1, ethers.utils.parseEther("10"), "Not my asset")
      ).to.be.revertedWith("Only asset owner can list asset");
    });
  });

  describe("Buying Assets", function () {
    beforeEach(async function () {
      // 用户1挂单资产
      await assetContract.connect(user1).approve(marketplaceContract.address, 1);
      await marketplaceContract.connect(user1).listAsset(1, ethers.utils.parseEther("10"), "Beautiful Chinese Art");

      // 用户2批准代币转账
      await tokenContract.connect(user2).approve(marketplaceContract.address, ethers.utils.parseEther("10"));
    });

    it("Should allow users to buy listed assets", async function () {
      // 用户2购买资产
      await marketplaceContract.connect(user2).buyAsset(1);

      // 检查资产所有权
      expect(await assetContract.ownerOf(1)).to.equal(user2.address);

      // 检查代币转账
      expect(await tokenContract.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("10"));

      // 检查挂单状态
      const listing = await marketplaceContract.getListing(1);
      expect(listing.isActive).to.equal(false);

      // 检查交易历史
      const txCount = await marketplaceContract.getTransactionCount();
      expect(txCount).to.equal(1);
    });

    it("Should not allow buying inactive listings", async function () {
      // 取消挂单
      await marketplaceContract.connect(user1).cancelListing(1);

      // 尝试购买
      await expect(
        marketplaceContract.connect(user2).buyAsset(1)
      ).to.be.revertedWith("Listing not active");
    });
  });

  describe("Managing Listings", function () {
    beforeEach(async function () {
      // 用户1挂单资产
      await assetContract.connect(user1).approve(marketplaceContract.address, 1);
      await marketplaceContract.connect(user1).listAsset(1, ethers.utils.parseEther("10"), "Beautiful Chinese Art");
    });

    it("Should allow sellers to cancel listings", async function () {
      await marketplaceContract.connect(user1).cancelListing(1);
      
      const listing = await marketplaceContract.getListing(1);
      expect(listing.isActive).to.equal(false);
    });

    it("Should allow sellers to change price", async function () {
      await marketplaceContract.connect(user1).changePrice(1, ethers.utils.parseEther("15"));
      
      const listing = await marketplaceContract.getListing(1);
      expect(listing.price).to.equal(ethers.utils.parseEther("15"));
    });

    it("Should not allow non-sellers to cancel listings", async function () {
      await expect(
        marketplaceContract.connect(user2).cancelListing(1)
      ).to.be.revertedWith("Only seller can cancel listing");
    });
  });

  describe("Querying Marketplace Data", function () {
    beforeEach(async function () {
      // 用户1挂单资产
      await assetContract.connect(user1).approve(marketplaceContract.address, 1);
      await marketplaceContract.connect(user1).listAsset(1, ethers.utils.parseEther("10"), "Beautiful Chinese Art");

      // 用户2批准代币转账并购买
      await tokenContract.connect(user2).approve(marketplaceContract.address, ethers.utils.parseEther("10"));
      await marketplaceContract.connect(user2).buyAsset(1);
    });

    it("Should return transaction history", async function () {
      const [tokenIds, sellers, buyers, prices, timestamps] = await marketplaceContract.getTransactionHistory(0, 10);
      
      expect(tokenIds.length).to.equal(1);
      expect(tokenIds[0]).to.equal(1);
      expect(sellers[0]).to.equal(user1.address);
      expect(buyers[0]).to.equal(user2.address);
      expect(prices[0]).to.equal(ethers.utils.parseEther("10"));
    });

    it("Should return user transaction history", async function () {
      const [tokenIds, counterparties, prices, timestamps, isBuyer] = 
        await marketplaceContract.getUserTransactionHistory(user2.address, 0, 10);
      
      expect(tokenIds.length).to.equal(1);
      expect(tokenIds[0]).to.equal(1);
      expect(counterparties[0]).to.equal(user1.address);
      expect(prices[0]).to.equal(ethers.utils.parseEther("10"));
      expect(isBuyer[0]).to.equal(true);
    });

    it("Should return active listing count", async function () {
      const count = await marketplaceContract.getActiveListingCount();
      expect(count).to.equal(0); // 因为已经被购买了
    });
  });
});
