// Converts all .png files in the folder to .basis
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const basis_path = '~/github/basis_universal/bin/basisu';

function recurse(dirPath) {
    // Read all the files/dirs at the specified path
    fs.readdir(dirPath, function (err, files) {
        //handling error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }

        // Loop through all the files
        for (let file of files) {
            let fullPath = path.join(dirPath, file);
            let stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                console.log ("Dir: " + file);
                recurse(fullPath);
            } else if (stat.isFile()) {
                if(file.endsWith('.png')) {
                    //fs.unlinkSync(fullPath);
                    exec(`${basis_path} ${fullPath} -mipmap -output_path ${dirPath}`, (err, stdout, stderr) => {
                        console.log(`Output for ${file}:`);
                        if (err) {
                            console.log(` - err: ${err}`); 
                            return;
                        }
                        
                        // the *entire* stdout and stderr (buffered)
                        console.log(` - stdout: ${stdout}`);
                        console.log(` - stderr: ${stderr}`);
                    });
                }
            }
        }
    });
}

//recurse(path.join(__dirname, 'models'));
recurse(path.join(__dirname, 'textures'));
