-- Remove the exact records created by the former deterministic demo seed.
-- User-created groups, profiles, games and ledger rows are not matched.
DELETE FROM "Game" WHERE "id" IN (
  'cmtv50ewq000rxsuy9igtadv4', 'cmtv50exq001gxsuy0iffrpab',
  'cmtv50eyu001wxsuyrkplpfjh', 'cmtv50ezt002exsuyvgsq4q8a',
  'cmtv50f0p002xxsuyky1p1g7n', 'cmtv50f1e003ixsuy0mghwsr4',
  'cmtv50f230047xsuytuzvojqd', 'cmtv50f2p004pxsuy6c29ru9p',
  'cmtv50f3e005axsuyfa9z39ya', 'cmtv50f40005zxsuyyy9ypcxo',
  'cmtv50f4q006rxsuy6baf4r03', 'cmtv50f5j007ixsuyyg4wy6uz',
  'cmtv50f670080xsuy0caibmw1', 'cmtv50f6u008gxsuyg0p8h28c',
  'cmtv50f7k008zxsuy0roihxn4', 'cmtv50f8e009qxsuy0u6rqwn6',
  'cmtv50f9900aexsuysiy680at', 'cmtv50fa300b3xsuyijn2bvmv',
  'cmtv50fax00bpxsuyquu6q3n9', 'cmtv50fbs00cexsuyi1521meh',
  'cmtv50fcp00czxsuyw4egcunt', 'cmtv50fdh00dkxsuy0ypp657k',
  'cmtv50fec00e8xsuyfw5anpyj', 'cmtv50ff500etxsuya052vw8c',
  'cmtv50fhm00fmxsuyzjn4ovvx'
);

DELETE FROM "Player" WHERE "id" IN (
  'cmtv50ena0000xsuy6pq3qhbm', 'cmtv50env0001xsuy9goaisti',
  'cmtv50eo90002xsuybhrrmass', 'cmtv50eok0003xsuyqg5przz4',
  'cmtv50eow0004xsuy44zhgge7', 'cmtv50epa0005xsuyf12ber29',
  'cmtv50epk0006xsuyiawskwyn', 'cmtv50epu0007xsuyfy0fp2i3',
  'cmtv50eq70008xsuydy5fynr1', 'cmtv50eql0009xsuyo88echbi',
  'cmtv50eqx000axsuyok9sfpf1', 'cmtv50er6000bxsuy3r3v0vrh',
  'cmtv50erf000cxsuyxd543wwf', 'cmtv50ero000dxsuympduxxrv',
  'cmtv50erx000exsuyi1hdar6j', 'cmtv50es7000fxsuyfh1xcr2l',
  'cmtv50esj000gxsuywjw5990c', 'cmtv50esu000hxsuy5km1auzo',
  'cmtv50et3000ixsuy9hwzv08f', 'cmtv50etd000jxsuyes7s5teo',
  'cmtv50etm000kxsuyp6ns9ezq', 'cmtv50etu000lxsuygx99tjdi',
  'cmtv50eu3000mxsuymuvj6qrz', 'cmtv50eud000nxsuyaz481ibj',
  'cmtv50eul000oxsuyy42o50pg', 'cmtv50euu000pxsuyklrbzg23',
  'cmtv50ev3000qxsuyg3yzxlpr'
);

-- Adrian was the demo owner. If that removal left a retained group ownerless,
-- promote one retained normal profile already in that group.
UPDATE "GroupMember"
SET "role" = 'OWNER'
WHERE ("groupId", "playerId") IN (
  SELECT "groupId", MIN("playerId")
  FROM "GroupMember"
  GROUP BY "groupId"
)
AND NOT EXISTS (
  SELECT 1 FROM "GroupMember" AS owner
  WHERE owner."groupId" = "GroupMember"."groupId" AND owner."role" = 'OWNER'
);
