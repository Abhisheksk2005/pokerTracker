-- Start the account-free app with no pre-created groups. Existing player
-- profiles, game entries and ledger rows remain intact and are adopted by the
-- first group created through the UI.
UPDATE "Game" SET "groupId" = NULL;
UPDATE "Transaction" SET "groupId" = NULL;
DELETE FROM "GroupMember";
DELETE FROM "PokerGroup";
