#!/bin/bash
yum -y install wget
wget http://mirror-fpt-telecom.fpt.net/fedora/epel/6/i386/epel-release-6-8.noarch.rpm
rpm -ivh epel-release-6-8.noarch.rpm
yum install -y git libvirt libvirt-python wget man python-pip sqlite-devel libxml2-python libxml2-devel libxslt-devel

/etc/init.d/libvirtd start
/etc/init.d/messagebus start
 
iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
service iptables save

echo '[Remote libvirt SSH access]
Identity=unix-user:virtkick
Action=org.libvirt.unix.manage
ResultAny=yes
ResultInactive=yes
ResultActive=yes
' > /etc/polkit-1/localauthority/50-local.d/50-libvirt.pkla
