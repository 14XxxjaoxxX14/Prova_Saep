const bcrypt = require('bcrypt');

const senhaPlana = 'Admin1234'; // Substitua pela senha que deseja gerar o hash
const saltRounds = 10;

bcrypt.hash(senhaPlana, saltRounds, function(err, hash) {
  if (err) throw err;
  console.log('O novo hash para a sua base de dados é:');
  console.log(hash);
});