#Build with regular command 
#   docker build -t node-pilot .
#
#You can then run with command below to run the node-pilot server exposed on port 34416
#   docker run --privileged -it -p 80:80 -p 443:443 -p 22:22 -p 34416:34416 -p 19999:19999 -p 26656:26656 --name node-pilot -v /var/run/docker.sock:/var/run/docker.sock node-pilot:latest
#
#Alternatively you can use the command below to enter into the container with /bin/bash and execute a command like `node ./test.js` to try out the library
#   docker exec -it node-pilot /bin/bash
# 



FROM node:buster
RUN apt-get update 
RUN apt install docker.io -y
RUN docker --version

LABEL maintainer="Jeremi [IoTeX]#6988"

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

RUN mkdir bin
RUN wget -O ./bin/np https://builds.decentralizedauthority.com/node-pilot/v0.11.1/np 
RUN chmod +x ./bin/np 

EXPOSE 80 443 22 34416 19999 26656

ENTRYPOINT nohup dockerd >/dev/null 2>&1 & sleep 10 && ./bin/np



