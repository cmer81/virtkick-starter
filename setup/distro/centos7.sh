#!/bin/bash
yum install -y http://download.fedoraproject.org/pub/epel/7/x86_64/e/epel-release-7-5.noarch.rpm
yum install -y @development qemu qemu-kvm libvirt libvirt-python wget man python-pip sqlite-devel libxml2-python libxml2-devel libxslt-devel
systemctl enable libvirtd
systemctl start libvirtd

echo '[Remote libvirt SSH access]
Identity=unix-user:virtkick
Action=org.libvirt.unix.manage
ResultAny=yes
ResultInactive=yes
ResultActive=yes
' > /etc/polkit-1/localauthority/50-local.d/50-libvirt.pkla
